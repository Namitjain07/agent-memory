import { InMemoryAdapter } from "../adapters/in-memory";
import type {
  AgentMemoryOptions,
  BatchRememberInput,
  BatchRememberResult,
  EmbedBatchFn,
  EmbeddingCache,
  EmbedFn,
  InjectOptions,
  RecallOptions,
  RecallResult,
  RememberEntryInput,
  RememberFactInput,
  RememberInput,
  RetrievalWeights,
  SummariseFn,
  SummariseOptions,
  TokenCounterFn
} from "../types/config";
import type { MemoryAdapter } from "../types/adapter";
import type {
  MemoryEntry,
  MemoryFact,
  MemoryItem,
  MemoryMessage,
  MemoryStats,
  MemorySummary,
  MemoryTier
} from "../types/memory";
import { formatRecallResults } from "../utils/format";
import { createMemoryId } from "../utils/ids";
import { clamp, cosineSimilarity, normalizeSimilarity } from "../utils/math";
import { recencyScore } from "../utils/time";
import { approximateTokenCount } from "../utils/tokens";
import { bm25Scores } from "../utils/bm25";
import { LRU } from "../utils/lru";
import { ConfigurationError, StorageError } from "../utils/errors";

const DEFAULT_WEIGHTS: RetrievalWeights = {
  similarity: 0.55,
  keyword: 0.15,
  recency: 0.2,
  importance: 0.1
};

export class AgentMemory {
  private readonly adapter: MemoryAdapter;

  private readonly defaultSessionId: string;
  private readonly defaultUserId: string | undefined;
  private readonly defaultAgentId: string | undefined;
  private readonly defaultTier: MemoryTier;

  private readonly retrieval: {
    topK: number;
    candidateMultiplier: number;
    recencyLambda: number;
    minScore: number;
    weights: RetrievalWeights;
  };

  private readonly summarisation: {
    maxTurns: number;
    tokenBudget: number;
    keepRecentTurns: number;
    summariseFn: SummariseFn | undefined;
    tokenCounter: TokenCounterFn;
  };

  private readonly embedFn: EmbedFn | undefined;
  private readonly embedBatchFn: EmbedBatchFn | undefined;
  private readonly embedCache: EmbeddingCache | undefined;
  private readonly debug: boolean;

  constructor(options: AgentMemoryOptions = {}) {
    this.adapter = options.adapter ?? new InMemoryAdapter();
    this.defaultSessionId = options.defaultSessionId ?? "default";
    this.defaultUserId = options.defaultUserId;
    this.defaultAgentId = options.defaultAgentId;
    this.defaultTier = options.defaultTier ?? "session";
    this.retrieval = {
      topK: options.retrieval?.topK ?? 5,
      candidateMultiplier: options.retrieval?.candidateMultiplier ?? 4,
      recencyLambda: options.retrieval?.recencyLambda ?? 0.03,
      minScore: options.retrieval?.minScore ?? 0,
      weights: {
        ...DEFAULT_WEIGHTS,
        ...(options.retrieval?.weights ?? {})
      }
    };
    this.summarisation = {
      maxTurns: options.summarisation?.maxTurns ?? 24,
      tokenBudget: options.summarisation?.tokenBudget ?? 3000,
      keepRecentTurns: options.summarisation?.keepRecentTurns ?? 8,
      summariseFn: options.summarisation?.summariseFn,
      tokenCounter: options.summarisation?.tokenCounter ?? approximateTokenCount
    };
    this.embedFn = options.embedding?.embedFn;
    this.embedBatchFn = options.embedding?.embedBatchFn;
    this.embedCache =
      options.embedding?.cache ??
      (this.embedFn || this.embedBatchFn ? new LRU<string, number[]>(1_000) : undefined);
    this.debug = options.debug ?? false;
  }

  // ─── Public Write API ────────────────────────────────────────────────────────

  async remember(input: RememberInput): Promise<MemoryEntry | MemoryFact> {
    if (input.kind === "fact") {
      return this.rememberFact(input);
    }
    return this.rememberEntry(input);
  }

  /**
   * Store many memory items in a single call. Embedding calls are
   * bounded by `concurrency` to avoid overwhelming the embedding provider.
   * Errors on individual items are captured in the `errors` array — the
   * batch never throws because of a single bad item.
   */
  async rememberBatch(input: BatchRememberInput): Promise<BatchRememberResult> {
    const concurrency = Math.max(1, input.concurrency ?? 5);
    const stored: Array<MemoryEntry | MemoryFact> = [];
    const errors: Array<{ index: number; error: Error }> = [];

    // Simple rolling window — no need for a full pool
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < input.items.length) {
        const idx = nextIndex;
        nextIndex += 1;
        const item = input.items[idx]!;
        try {
          const result = await this.remember(item);
          stored.push(result);
        } catch (err) {
          errors.push({
            index: idx,
            error: err instanceof Error ? err : new Error(String(err))
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, input.items.length) }, worker));
    return { stored, errors };
  }

  async forget(id: string): Promise<void> {
    try {
      await this.adapter.delete(id);
    } catch (err) {
      throw new StorageError(
        `Failed to forget item ${id}: ${err instanceof Error ? err.message : String(err)}`,
        { source: "AgentMemory.forget", cause: err, id }
      );
    }
  }

  async update(
    id: string,
    data: Partial<Pick<MemoryItem, "importance" | "embedding" | "metadata" | "content">> & {
      tier?: MemoryTier;
      userId?: string;
      agentId?: string;
    }
  ): Promise<void> {
    try {
      await this.adapter.update(id, data);
    } catch (err) {
      throw new StorageError(
        `Failed to update item ${id}: ${err instanceof Error ? err.message : String(err)}`,
        { source: "AgentMemory.update", cause: err, id }
      );
    }
  }

  /**
   * Delete all memory items for a session.
   * Useful for resetting conversations or clearing test state.
   */
  async clear(sessionId?: string): Promise<void> {
    const sid = this.resolveSessionId(sessionId);
    if (this.adapter.clear) {
      await this.adapter.clear(sid);
      return;
    }
    // Fallback: delete item by item
    const items = await this.adapter.getBySession(sid);
    for (const item of items) {
      await this.adapter.delete(item.id);
    }
  }

  // ─── Public Read API ─────────────────────────────────────────────────────────

  async recall(query: string, options: RecallOptions = {}): Promise<RecallResult[]> {
    const sessionId = this.resolveSessionId(options.sessionId);
    const topK = options.topK ?? this.retrieval.topK;
    const minScore = options.minScore ?? this.retrieval.minScore;
    const candidateLimit = Math.max(topK, topK * this.retrieval.candidateMultiplier);

    // If no embed function is configured, fall back to recency+importance only
    let queryVector: number[] | null = null;
    if (this.embedFn || this.embedBatchFn) {
      try {
        const [vec] = await this.embed([query]);
        queryVector = vec ?? null;
        if (!queryVector && this.debug) {
          console.warn("[agent-memory] embed returned empty vector; recall will use recency+importance only");
        }
      } catch (err) {
        if (this.debug) {
          console.warn(
            `[agent-memory] Embedding failed during recall; falling back to recency+importance scoring. cause: ${(err as Error).message}`
          );
        }
      }
    }

    let candidates: Array<{ item: MemoryItem; similarity?: number }>;
    const searchOptions = {
      sessionId,
      limit: candidateLimit,
      ...(options.kinds ? { kinds: options.kinds } : {}),
      ...(options.tiers ? { tiers: options.tiers } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {})
    };

    if (queryVector) {
      candidates = await this.adapter.search(queryVector, searchOptions);
    } else {
      // No vector — fetch all and score without similarity
      const allItems = await this.adapter.getBySession(sessionId);
      const filtered = this.applyKindTierFilter(allItems, options);
      candidates = filtered
        .slice(0, candidateLimit)
        .map((item) => ({ item }) as { item: MemoryItem; similarity?: number });
    }

    // Pre-compute keyword scores if keyword weight > 0
    const keywordMap =
      this.retrieval.weights.keyword > 0
        ? bm25Scores(
            query,
            candidates.map((c) => c.item)
          )
        : new Map<string, number>();

    const now = Date.now();
    const weights = this.retrieval.weights;

    const scored = candidates
      .map((candidate) => {
        const item = candidate.item;
        const similarity = queryVector ? this.resolveSimilarity(candidate.similarity, item, queryVector) : 0;
        const keyword = keywordMap.get(item.id) ?? 0;
        const recency = recencyScore(item.timestamp, now, this.retrieval.recencyLambda);
        const importance = clamp(item.importance ?? 0.5, 0, 1);
        const score =
          weights.similarity * similarity +
          weights.keyword * keyword +
          weights.recency * recency +
          weights.importance * importance;

        return { item, score, similarity, keyword, recency, importance };
      })
      .filter((r) => (minScore > 0 ? r.score >= minScore : true))
      .filter((r) => (options.filter ? options.filter(r.item) : true))
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  async summarise(options: SummariseOptions = {}): Promise<MemorySummary | null> {
    const sessionId = this.resolveSessionId(options.sessionId);
    const maxTurns = options.maxTurns ?? this.summarisation.maxTurns;
    const tokenBudget = options.tokenBudget ?? this.summarisation.tokenBudget;
    const keepRecentTurns = options.keepRecentTurns ?? this.summarisation.keepRecentTurns;

    const allItems = await this.adapter.getBySession(sessionId);
    const entries = allItems
      .filter((item): item is MemoryEntry => item.kind === "entry")
      .sort((a, b) => a.timestamp - b.timestamp);

    if (entries.length < 2) {
      return null;
    }

    const totalTokens = entries.reduce(
      (sum, entry) => sum + this.summarisation.tokenCounter(entry.content),
      0
    );
    const exceedsMaxTurns = entries.length > maxTurns;
    const exceedsTokenBudget = totalTokens > tokenBudget;
    const shouldSummarise = options.force === true || exceedsMaxTurns || exceedsTokenBudget;

    if (!shouldSummarise) {
      return null;
    }

    const toReplace = this.pickEntriesForSummary({
      entries,
      keepRecentTurns,
      maxTurns,
      tokenBudget
    });

    if (toReplace.length === 0) {
      return null;
    }

    const summaryText = this.summarisation.summariseFn
      ? await this.summarisation.summariseFn({
          sessionId,
          entries: toReplace,
          tokenCount: toReplace.reduce(
            (sum, entry) => sum + this.summarisation.tokenCounter(entry.content),
            0
          )
        })
      : this.defaultSummary(toReplace);

    for (const entry of toReplace) {
      await this.adapter.delete(entry.id);
    }

    const summary: MemorySummary = {
      id: createMemoryId("summary"),
      kind: "summary",
      sessionId,
      tier: "session",
      timestamp: Date.now(),
      importance: 0.7,
      content: summaryText,
      fromTimestamp: toReplace[0]!.timestamp,
      toTimestamp: toReplace[toReplace.length - 1]!.timestamp,
      replacedEntryIds: toReplace.map((entry) => entry.id)
    };

    await this.adapter.add(summary);
    return summary;
  }

  async inject(messages: MemoryMessage[], options: InjectOptions = {}): Promise<MemoryMessage[]> {
    const query = options.query ?? this.lastUserMessage(messages)?.content;
    if (!query) {
      return [...messages];
    }

    const recalled = await this.recall(query, options);
    if (recalled.length === 0) {
      return [...messages];
    }

    const memoryBlock = options.format?.(recalled) ?? formatRecallResults(recalled, options.maxContentLength);
    const memoryMessage: MemoryMessage = {
      role: options.role ?? "system",
      name: options.name ?? "memory",
      content: memoryBlock
    };

    const stripped = messages.filter((message) => !(message.role === "system" && message.name === "memory"));
    const insertAt = this.firstNonSystemIndex(stripped);

    return [...stripped.slice(0, insertAt), memoryMessage, ...stripped.slice(insertAt)];
  }

  async getBySession(sessionId?: string): Promise<MemoryItem[]> {
    return this.adapter.getBySession(this.resolveSessionId(sessionId));
  }

  /**
   * Return item counts for a session (or all sessions via adapter.getBySession).
   * Reports byKind and byTier, plus the unique user/agent ids encountered.
   */
  async stats(sessionId?: string): Promise<MemoryStats> {
    const sid = this.resolveSessionId(sessionId);
    const items = await this.adapter.getBySession(sid);
    const byKind: MemoryStats["byKind"] = { entry: 0, fact: 0, summary: 0 };
    const byTier: Record<string, number> = {};
    const userIds = new Set<string>();
    const agentIds = new Set<string>();
    for (const item of items) {
      byKind[item.kind] += 1;
      const tier = item.tier ?? "session";
      byTier[tier] = (byTier[tier] ?? 0) + 1;
      if (item.userId) userIds.add(item.userId);
      if (item.agentId) agentIds.add(item.agentId);
    }
    const stats: MemoryStats = {
      total: items.length,
      byKind,
      sessionIds: [sid]
    };
    if (Object.keys(byTier).length > 0) {
      stats.byTier = byTier as Partial<Record<MemoryTier, number>>;
    }
    if (userIds.size > 0) stats.userIds = Array.from(userIds);
    if (agentIds.size > 0) stats.agentIds = Array.from(agentIds);
    return stats;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async rememberEntry(input: RememberEntryInput): Promise<MemoryEntry> {
    if (!input.content || input.content.trim().length === 0) {
      throw new ConfigurationError("Cannot store an entry with empty content.", {
        source: "AgentMemory.rememberEntry"
      });
    }

    const embedding =
      input.embedding !== undefined ? input.embedding : await this.tryEmbedSingle(input.content);
    const entry: MemoryEntry = {
      id: input.id ?? createMemoryId("entry"),
      kind: "entry",
      sessionId: this.resolveSessionId(input.sessionId),
      role: input.role,
      content: input.content,
      timestamp: input.timestamp ?? Date.now(),
      importance: clamp(input.importance ?? 0.5, 0, 1)
    };
    const tier = this.resolveTier(input.tier);
    if (tier) entry.tier = tier;
    const userId = input.userId ?? this.defaultUserId;
    if (userId) entry.userId = userId;
    const agentId = input.agentId ?? this.defaultAgentId;
    if (agentId) entry.agentId = agentId;
    if (embedding) entry.embedding = embedding;
    if (input.metadata) entry.metadata = input.metadata;

    await this.adapter.add(entry);
    return entry;
  }

  private async rememberFact(input: RememberFactInput): Promise<MemoryFact> {
    const content = `${input.key}: ${input.value}`;
    const embedding = input.embedding ?? (await this.tryEmbedSingle(content));

    const fact: MemoryFact = {
      id: input.id ?? createMemoryId("fact"),
      kind: "fact",
      sessionId: this.resolveSessionId(input.sessionId),
      key: input.key,
      value: input.value,
      content,
      timestamp: input.timestamp ?? Date.now(),
      importance: clamp(input.importance ?? 0.5, 0, 1)
    };
    const tier = this.resolveTier(input.tier);
    if (tier) fact.tier = tier;
    const userId = input.userId ?? this.defaultUserId;
    if (userId) fact.userId = userId;
    const agentId = input.agentId ?? this.defaultAgentId;
    if (agentId) fact.agentId = agentId;
    if (embedding) fact.embedding = embedding;
    if (input.metadata) fact.metadata = input.metadata;

    await this.adapter.add(fact);
    return fact;
  }

  private async tryEmbedSingle(text: string): Promise<number[] | null> {
    if (!this.embedFn && !this.embedBatchFn) {
      return null;
    }

    if (this.embedCache) {
      const cached = this.embedCache.get(text);
      if (cached) {
        if (this.debug) console.debug(`[agent-memory] embed cache hit (${text.length} chars)`);
        return cached;
      }
    }

    try {
      const [vector] = await this.embed([text]);
      if (vector && this.embedCache) this.embedCache.set(text, vector);
      return vector ?? null;
    } catch (err) {
      if (this.debug) console.warn(`[agent-memory] embed failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (this.embedCache) {
      // Split into cache-hits and cache-misses
      const hits: Array<{ index: number; value: number[] }> = [];
      const misses: Array<{ index: number; text: string }> = [];
      texts.forEach((text, index) => {
        const cached = this.embedCache!.get(text);
        if (cached) hits.push({ index, value: cached });
        else misses.push({ index, text });
      });

      const results: number[][] = new Array(texts.length);
      for (const hit of hits) results[hit.index] = hit.value;
      if (misses.length === 0) return results;

      const fresh = await this.embedUncached(misses.map((m) => m.text));
      for (let i = 0; i < misses.length; i += 1) {
        const vector = fresh[i]!;
        const meta = misses[i]!;
        results[meta.index] = vector;
        this.embedCache.set(meta.text, vector);
      }
      return results;
    }

    return this.embedUncached(texts);
  }

  private async embedUncached(texts: string[]): Promise<number[][]> {
    if (this.embedBatchFn) {
      const result = await this.embedBatchFn(texts);
      if (this.debug) console.debug(`[agent-memory] batch embed (${texts.length} texts)`);
      return result;
    }
    if (this.embedFn) {
      const result = await Promise.all(texts.map((text) => this.embedFn!(text)));
      if (this.debug) console.debug(`[agent-memory] parallel single embed (${texts.length} texts)`);
      return result;
    }

    throw new ConfigurationError(
      "No embedding function configured. Provide embedding.embedFn or embedding.embedBatchFn.",
      { source: "AgentMemory.embed" }
    );
  }

  private applyKindTierFilter(
    items: MemoryItem[],
    options: {
      kinds?: ReadonlyArray<MemoryItem["kind"]>;
      tiers?: ReadonlyArray<MemoryTier>;
      userId?: string;
      agentId?: string;
    }
  ): MemoryItem[] {
    return items.filter((item) => {
      if (options.kinds && !options.kinds.includes(item.kind)) return false;
      if (options.tiers) {
        const tier = item.tier ?? "session";
        if (!options.tiers.includes(tier)) return false;
      }
      if (options.userId && item.userId !== options.userId) return false;
      if (options.agentId && item.agentId !== options.agentId) return false;
      return true;
    });
  }

  private resolveSimilarity(
    providedSimilarity: number | undefined,
    item: MemoryItem,
    queryVector: number[]
  ): number {
    if (typeof providedSimilarity === "number") {
      return clamp(providedSimilarity, 0, 1);
    }

    if (!item.embedding || item.embedding.length !== queryVector.length) {
      return 0;
    }

    return normalizeSimilarity(cosineSimilarity(queryVector, item.embedding));
  }

  private firstNonSystemIndex(messages: MemoryMessage[]): number {
    let index = 0;
    while (index < messages.length && messages[index]!.role === "system") {
      index += 1;
    }
    return index;
  }

  private lastUserMessage(messages: MemoryMessage[]): MemoryMessage | undefined {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]!.role === "user") {
        return messages[i];
      }
    }
    return undefined;
  }

  private resolveSessionId(sessionId?: string): string {
    return sessionId ?? this.defaultSessionId;
  }

  private resolveTier(tier: MemoryTier | undefined): MemoryTier | undefined {
    if (tier) return tier;
    if (this.defaultTier !== "session") return this.defaultTier;
    return undefined;
  }

  private defaultSummary(entries: MemoryEntry[]): string {
    const lines = entries.map((entry) => `- ${entry.role}: ${entry.content.replace(/\s+/g, " ").trim()}`);
    return `Summary of previous conversation:\n${lines.join("\n")}`;
  }

  private pickEntriesForSummary(input: {
    entries: MemoryEntry[];
    keepRecentTurns: number;
    maxTurns: number;
    tokenBudget: number;
  }): MemoryEntry[] {
    const { entries, keepRecentTurns, maxTurns, tokenBudget } = input;
    const keep = Math.max(1, Math.min(keepRecentTurns, entries.length - 1));
    const candidates = entries.slice(0, entries.length - keep);
    if (candidates.length === 0) {
      return [];
    }

    const picked: MemoryEntry[] = [];
    let candidateIndex = 0;
    let remainingTurns = entries.length;
    let remainingTokens = entries.reduce(
      (sum, entry) => sum + this.summarisation.tokenCounter(entry.content),
      0
    );

    while (
      candidateIndex < candidates.length &&
      (remainingTurns > maxTurns || remainingTokens > tokenBudget)
    ) {
      const next = candidates[candidateIndex]!;
      picked.push(next);
      candidateIndex += 1;
      remainingTurns -= 1;
      remainingTokens -= this.summarisation.tokenCounter(next.content);
    }

    if (picked.length === 0) {
      picked.push(candidates[0]!);
    }

    return picked;
  }
}

// Re-export MemoryStats so consumers don't need a separate import
export type { MemoryStats };

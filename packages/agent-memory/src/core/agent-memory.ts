import { InMemoryAdapter } from "../adapters/in-memory";
import type {
  AgentMemoryOptions,
  EmbedBatchFn,
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
  MemorySummary
} from "../types/memory";
import { formatRecallResults } from "../utils/format";
import { createMemoryId } from "../utils/ids";
import { clamp, cosineSimilarity, normalizeSimilarity } from "../utils/math";
import { recencyScore } from "../utils/time";
import { approximateTokenCount } from "../utils/tokens";

const DEFAULT_WEIGHTS: RetrievalWeights = {
  similarity: 0.6,
  recency: 0.3,
  importance: 0.1
};

export class AgentMemory {
  private readonly adapter: MemoryAdapter;

  private readonly defaultSessionId: string;

  private readonly retrieval: {
    topK: number;
    candidateMultiplier: number;
    recencyLambda: number;
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

  constructor(options: AgentMemoryOptions = {}) {
    this.adapter = options.adapter ?? new InMemoryAdapter();
    this.defaultSessionId = options.defaultSessionId ?? "default";
    this.retrieval = {
      topK: options.retrieval?.topK ?? 5,
      candidateMultiplier: options.retrieval?.candidateMultiplier ?? 4,
      recencyLambda: options.retrieval?.recencyLambda ?? 0.03,
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
  }

  // ─── Public Write API ────────────────────────────────────────────────────────

  async remember(input: RememberInput): Promise<MemoryEntry | MemoryFact> {
    if (input.kind === "fact") {
      return this.rememberFact(input);
    }
    return this.rememberEntry(input);
  }

  async forget(id: string): Promise<void> {
    await this.adapter.delete(id);
  }

  async update(id: string, data: Partial<Pick<MemoryItem, "importance" | "embedding" | "metadata" | "content">>): Promise<void> {
    await this.adapter.update(id, data);
  }

  /**
   * Delete all memory items for a session.
   * Useful for resetting conversations or clearing test state.
   */
  async clear(sessionId?: string): Promise<void> {
    const sid = this.resolveSessionId(sessionId);
    // Support adapters that implement clear() natively for efficiency
    if ("clear" in this.adapter && typeof (this.adapter as { clear: unknown }).clear === "function") {
      await (this.adapter as { clear: (sessionId: string) => Promise<void> }).clear(sid);
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
    const candidateLimit = Math.max(topK, topK * this.retrieval.candidateMultiplier);

    // If no embed function is configured, fall back to recency+importance only
    let queryVector: number[] | null = null;
    if (this.embedFn || this.embedBatchFn) {
      try {
        const [vec] = await this.embed([query]);
        queryVector = vec ?? null;
      } catch {
        console.warn("[agent-memory] Embedding failed during recall; falling back to recency+importance scoring.");
      }
    }

    let candidates;
    if (queryVector) {
      candidates = await this.adapter.search(queryVector, {
        sessionId,
        limit: candidateLimit,
        ...(options.kinds ? { kinds: options.kinds } : {})
      });
    } else {
      // No vector — fetch all and score without similarity
      const allItems = await this.adapter.getBySession(sessionId);
      const filtered = options.kinds
        ? allItems.filter((item) => options.kinds!.includes(item.kind))
        : allItems;
      candidates = filtered
        .slice(0, candidateLimit)
        .map((item) => ({ item, similarity: undefined as number | undefined }));
    }

    const now = Date.now();
    const weights = this.retrieval.weights;

    const scored = candidates
      .map((candidate) => {
        const item = candidate.item;
        const similarity = queryVector
          ? this.resolveSimilarity(candidate.similarity, item, queryVector)
          : 0;
        const recency = recencyScore(item.timestamp, now, this.retrieval.recencyLambda);
        const importance = clamp(item.importance ?? 0.5, 0, 1);
        const score =
          weights.similarity * similarity +
          weights.recency * recency +
          weights.importance * importance;

        return { item, score, similarity, recency, importance };
      })
      .filter((r) => (options.minScore == null ? true : r.score >= options.minScore))
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

  async inject(
    messages: MemoryMessage[],
    options: InjectOptions = {}
  ): Promise<MemoryMessage[]> {
    const query = options.query ?? this.lastUserMessage(messages)?.content;
    if (!query) {
      return [...messages];
    }

    const recalled = await this.recall(query, options);
    if (recalled.length === 0) {
      return [...messages];
    }

    const memoryBlock =
      options.format?.(recalled) ??
      formatRecallResults(recalled, options.maxContentLength);
    const memoryMessage: MemoryMessage = {
      role: options.role ?? "system",
      name: options.name ?? "memory",
      content: memoryBlock
    };

    const stripped = messages.filter(
      (message) => !(message.role === "system" && message.name === "memory")
    );
    const insertAt = this.firstNonSystemIndex(stripped);

    return [
      ...stripped.slice(0, insertAt),
      memoryMessage,
      ...stripped.slice(insertAt)
    ];
  }

  async getBySession(sessionId?: string): Promise<MemoryItem[]> {
    return this.adapter.getBySession(this.resolveSessionId(sessionId));
  }

  /**
   * Return item counts for a session (or all sessions via adapter.getBySession).
   */
  async stats(sessionId?: string): Promise<MemoryStats> {
    const sid = this.resolveSessionId(sessionId);
    const items = await this.adapter.getBySession(sid);
    const byKind: MemoryStats["byKind"] = { entry: 0, fact: 0, summary: 0 };
    for (const item of items) {
      byKind[item.kind] += 1;
    }
    return { total: items.length, byKind, sessionIds: [sid] };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async rememberEntry(input: RememberEntryInput): Promise<MemoryEntry> {
    if (!input.content || input.content.trim().length === 0) {
      throw new Error("[agent-memory] Cannot store an entry with empty content.");
    }

    // Auto-embed entries (parity with rememberFact)
    const embedding =
      input.embedding !== undefined
        ? input.embedding
        : await this.tryEmbedSingle(input.content);

    const entry: MemoryEntry = {
      id: input.id ?? createMemoryId("entry"),
      kind: "entry",
      sessionId: this.resolveSessionId(input.sessionId),
      role: input.role,
      content: input.content,
      timestamp: input.timestamp ?? Date.now(),
      importance: clamp(input.importance ?? 0.5, 0, 1)
    };
    if (embedding !== null && embedding !== undefined) {
      entry.embedding = embedding;
    }
    if (input.metadata) {
      entry.metadata = input.metadata;
    }

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
    if (embedding !== null && embedding !== undefined) {
      fact.embedding = embedding;
    }
    if (input.metadata) {
      fact.metadata = input.metadata;
    }

    await this.adapter.add(fact);
    return fact;
  }

  private async tryEmbedSingle(text: string): Promise<number[] | null> {
    if (!this.embedFn && !this.embedBatchFn) {
      return null;
    }

    try {
      const [vector] = await this.embed([text]);
      return vector ?? null;
    } catch {
      return null;
    }
  }

  private async embed(texts: string[]): Promise<number[][]> {
    if (this.embedBatchFn) {
      return this.embedBatchFn(texts);
    }
    if (this.embedFn) {
      return Promise.all(texts.map((text) => this.embedFn!(text)));
    }

    throw new Error(
      "No embedding function configured. Provide embedding.embedFn or embedding.embedBatchFn."
    );
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

  private defaultSummary(entries: MemoryEntry[]): string {
    const lines = entries.map(
      (entry) => `- ${entry.role}: ${entry.content.replace(/\s+/g, " ").trim()}`
    );
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
    // Fix: track remaining against the candidates we can remove, not total entries
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

import type { MemoryAdapter, MemorySearchOptions, MemoryUpdate } from "./adapter";
import type {
  MemoryEntry,
  MemoryFact,
  MemoryItem,
  MemoryKind,
  MemoryMessage,
  MemoryRole,
  MemoryStats,
  MemorySummary,
  MemoryTier
} from "./memory";

export type EmbedFn = (text: string) => Promise<number[]>;
export type EmbedBatchFn = (texts: string[]) => Promise<number[][]>;
export type TokenCounterFn = (text: string) => number;

export interface SummariseInput {
  sessionId: string;
  entries: MemoryEntry[];
  tokenCount: number;
}

export type SummariseFn = (input: SummariseInput) => Promise<string>;

export interface RetrievalWeights {
  similarity: number;
  /** Weight for keyword (BM25-style) match. Set 0 to disable. */
  keyword: number;
  recency: number;
  importance: number;
}

export interface RetrievalConfig {
  topK?: number;
  candidateMultiplier?: number;
  recencyLambda?: number;
  weights?: Partial<RetrievalWeights>;
  /**
   * When set, results must clear this minimum score.
   * Default: 0 (no filter).
   */
  minScore?: number;
}

export interface SummarisationConfig {
  maxTurns?: number;
  tokenBudget?: number;
  keepRecentTurns?: number;
  summariseFn?: SummariseFn;
  tokenCounter?: TokenCounterFn;
}

export interface EmbeddingConfig {
  embedFn?: EmbedFn;
  embedBatchFn?: EmbedBatchFn;
  /**
   * Optional in-memory embedding cache.
   * If a `Map<string, number[]>` is provided, the engine will use it
   * to skip re-embedding identical text within the same process.
   */
  cache?: EmbeddingCache;
}

/** Minimal interface for an embedding cache. */
export interface EmbeddingCache {
  get(text: string): number[] | undefined;
  set(text: string, embedding: number[]): void;
  clear(): void;
  readonly size: number;
}

export interface AgentMemoryOptions {
  adapter?: MemoryAdapter;
  embedding?: EmbeddingConfig;
  retrieval?: RetrievalConfig;
  summarisation?: SummarisationConfig;
  defaultSessionId?: string;
  defaultUserId?: string;
  defaultAgentId?: string;
  defaultTier?: MemoryTier;
  /**
   * If true, the engine logs lightweight debug messages (embed hits/misses,
   * scoring breakdowns). Default: false.
   */
  debug?: boolean;
}

export interface RememberBaseInput {
  sessionId?: string;
  id?: string;
  timestamp?: number;
  importance?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  tier?: MemoryTier;
  userId?: string;
  agentId?: string;
}

export interface RememberEntryInput extends RememberBaseInput {
  kind?: "entry";
  role: MemoryRole;
  content: string;
}

export interface RememberFactInput extends RememberBaseInput {
  kind: "fact";
  key: string;
  value: string;
}

export type RememberInput = RememberEntryInput | RememberFactInput;

export interface RecallOptions {
  sessionId?: string;
  topK?: number;
  kinds?: MemoryKind[];
  minScore?: number;
  /** Optional predicate to filter candidates after scoring. */
  filter?: (item: MemoryItem) => boolean;
  tiers?: MemoryTier[];
  userId?: string;
  agentId?: string;
}

export interface RecallResult {
  item: MemoryItem;
  score: number;
  similarity: number;
  keyword: number;
  recency: number;
  importance: number;
}

export interface InjectOptions extends RecallOptions {
  query?: string;
  format?: (results: RecallResult[]) => string;
  role?: "system";
  name?: string;
  /** Max characters per memory content snippet (default: 220). */
  maxContentLength?: number;
}

export interface SummariseOptions {
  sessionId?: string;
  force?: boolean;
  maxTurns?: number;
  tokenBudget?: number;
  keepRecentTurns?: number;
}

export interface WithMemoryRunOptions {
  sessionId?: string;
  topK?: number;
  importance?: number;
  userId?: string;
  agentId?: string;
  tier?: MemoryTier;
}

export type AgentFunction<TOutput, TExtra extends unknown[] = []> = (
  messages: MemoryMessage[],
  ...extra: TExtra
) => Promise<TOutput>;

export interface WithMemoryOptions extends AgentMemoryOptions {
  memory?: {
    remember: (input: RememberInput) => Promise<MemoryEntry | MemoryFact>;
    inject: (messages: MemoryMessage[], options?: InjectOptions) => Promise<MemoryMessage[]>;
    summarise: (options?: SummariseOptions) => Promise<MemorySummary | null>;
  };
  sessionId?: string;
  topK?: number;
  userId?: string;
  agentId?: string;
  tier?: MemoryTier;
  autoStoreInput?: boolean;
  autoStoreOutput?: boolean;
  /**
   * Auto-summarise after each turn. Defaults to `false`.
   * Set to `true` only if you have configured a `summariseFn`, otherwise
   * the default bullet-list summary is stored which is rarely useful.
   */
  autoSummarise?: boolean;
}

export interface BatchRememberInput {
  items: RememberInput[];
  /** Concurrency limit for embedding calls. Default: 5. */
  concurrency?: number;
}

export interface BatchRememberResult {
  stored: Array<MemoryEntry | MemoryFact>;
  errors: Array<{ index: number; error: Error }>;
}

// Re-export for adapter consumers
export type {
  MemoryAdapter,
  MemorySearchOptions,
  MemoryUpdate,
  MemoryEntry,
  MemoryFact,
  MemoryItem,
  MemoryKind,
  MemoryMessage,
  MemoryRole,
  MemoryStats,
  MemorySummary,
  MemoryTier
};

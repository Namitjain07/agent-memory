export { InMemoryAdapter } from "./adapters/in-memory";
export { AgentMemory } from "./core/agent-memory";
export { withMemory } from "./middleware/with-memory";

export type {
  MemoryAdapter,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate
} from "./types/adapter";
export type {
  AgentFunction,
  AgentMemoryOptions,
  EmbedBatchFn,
  EmbedFn,
  EmbeddingConfig,
  InjectOptions,
  RecallOptions,
  RecallResult,
  RememberEntryInput,
  RememberFactInput,
  RememberInput,
  RetrievalConfig,
  RetrievalWeights,
  SummarisationConfig,
  SummariseFn,
  SummariseInput,
  SummariseOptions,
  TokenCounterFn,
  WithMemoryOptions,
  WithMemoryRunOptions
} from "./types/config";
export type {
  BaseMemoryItem,
  MemoryEntry,
  MemoryFact,
  MemoryItem,
  MemoryKind,
  MemoryMessage,
  MemoryRole,
  MemorySummary
} from "./types/memory";

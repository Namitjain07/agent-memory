export { InMemoryAdapter } from "./adapters/in-memory";
export { AgentMemory } from "./core/agent-memory";
export { withMemory } from "./middleware/with-memory";
export {
  createBatchEmbedFn,
  createOpenAIEmbedFn,
  createOpenAIBatchEmbedFn
} from "./utils/embed-helpers";

// ─── Providers ────────────────────────────────────────────────────────────────
export {
  createProvider,
  openaiProvider,
  nvidiaProvider,
  mistralProvider,
  azureOpenAIProvider,
  cohereProvider,
  googleProvider,
  anthropicProvider,
  voyageProvider,
  ollamaProvider
} from "./providers/index";

export type {
  MemoryProvider,
  ProviderName,
  ProviderOptionsMap,
  OpenAIProviderOptions,
  NVIDIAProviderOptions,
  MistralProviderOptions,
  AzureOpenAIProviderOptions,
  CohereProviderOptions,
  GoogleProviderOptions,
  AnthropicProviderOptions,
  VoyageProviderOptions,
  OllamaProviderOptions
} from "./providers/index";

// ─── Adapter types ────────────────────────────────────────────────────────────
export type {
  MemoryAdapter,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate
} from "./types/adapter";

// ─── Config types ─────────────────────────────────────────────────────────────
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

// ─── Memory types ─────────────────────────────────────────────────────────────
export type {
  BaseMemoryItem,
  MemoryEntry,
  MemoryFact,
  MemoryItem,
  MemoryKind,
  MemoryMessage,
  MemoryRole,
  MemoryStats,
  MemorySummary
} from "./types/memory";

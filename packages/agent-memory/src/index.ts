export { InMemoryAdapter } from "./adapters/in-memory";
export { AgentMemory } from "./core/agent-memory";
export { withMemory } from "./middleware/with-memory";
export { createBatchEmbedFn, createOpenAIEmbedFn, createOpenAIBatchEmbedFn } from "./utils/embed-helpers";

// ─── Error classes ───────────────────────────────────────────────────────────
export {
  MemoryError,
  EmbeddingError,
  ProviderError,
  NetworkError,
  TimeoutError,
  AbortError,
  StorageError,
  ConfigurationError,
  isMemoryError
} from "./utils/errors";

// ─── HTTP utilities ──────────────────────────────────────────────────────────
export {
  fetchJSON,
  fetchGetJSON,
  DEFAULT_RETRY_POLICY,
  type RetryPolicy,
  type RequestOptions
} from "./utils/http";

// ─── Encryption utilities ───────────────────────────────────────────────────
export {
  encrypt,
  decrypt,
  generateKey,
  keyFromPassphrase,
  envelopeToString,
  envelopeFromString,
  type EncryptedEnvelope
} from "./utils/encryption";

// ─── LRU cache ──────────────────────────────────────────────────────────────
export { LRU } from "./utils/lru";
export type { EmbeddingCache } from "./types/config";

// ─── BM25 keyword scoring ───────────────────────────────────────────────────
export { bm25Scores, tokenize } from "./utils/bm25";

// ─── PII redaction ──────────────────────────────────────────────────────────
export { piiScan, redactPII, type PIIRedactOptions, type PIIScanResult, type PIICategory } from "./utils/pii";

// ─── Scoring / merging utilities ─────────────────────────────────────────────
export { cosineSimilarity, normalizeSimilarity, clamp } from "./utils/math";
export { recencyScore } from "./utils/time";
export { approximateTokenCount } from "./utils/tokens";
export { deduplicateSimilarFacts, mergeSimilarEntries } from "./utils/memory-ops";

// ─── Providers ───────────────────────────────────────────────────────────────
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

// ─── Adapter types ───────────────────────────────────────────────────────────
export type {
  MemoryAdapter,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate
} from "./types/adapter";

// ─── Config types ────────────────────────────────────────────────────────────
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
  WithMemoryRunOptions,
  MemoryTier
} from "./types/config";

// ─── Memory types ────────────────────────────────────────────────────────────
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

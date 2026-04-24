/**
 * Provider registry and unified createProvider factory.
 *
 * @example
 * // Option 1: factory (type-safe overloads)
 * import { createProvider } from "@namitjain.india/agent-memory";
 * const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
 *
 * // Option 2: named import (tree-shaking friendly)
 * import { openaiProvider } from "@namitjain.india/agent-memory";
 * const provider = openaiProvider({ apiKey: process.env.OPENAI_API_KEY });
 *
 * // Use with AgentMemory
 * const memory = new AgentMemory({
 *   embedding: provider,
 *   summarisation: { summariseFn: provider.summarise }
 * });
 */

export type { MemoryProvider } from "./types";

// ─── Named provider exports ───────────────────────────────────────────────────

export {
  openaiProvider,
  nvidiaProvider,
  mistralProvider,
  azureOpenAIProvider,
  type OpenAIProviderOptions,
  type NVIDIAProviderOptions,
  type MistralProviderOptions,
  type AzureOpenAIProviderOptions
} from "./openai-compatible";

export {
  cohereProvider,
  type CohereProviderOptions
} from "./cohere";

export {
  googleProvider,
  type GoogleProviderOptions
} from "./google";

export {
  anthropicProvider,
  type AnthropicProviderOptions
} from "./anthropic";

export {
  voyageProvider,
  type VoyageProviderOptions
} from "./voyage";

export {
  ollamaProvider,
  type OllamaProviderOptions
} from "./ollama";

// ─── createProvider factory ───────────────────────────────────────────────────

import { openaiProvider, nvidiaProvider, mistralProvider, azureOpenAIProvider } from "./openai-compatible";
import { cohereProvider } from "./cohere";
import { googleProvider } from "./google";
import { anthropicProvider } from "./anthropic";
import { voyageProvider } from "./voyage";
import { ollamaProvider } from "./ollama";

import type { MemoryProvider } from "./types";
import type {
  OpenAIProviderOptions,
  NVIDIAProviderOptions,
  MistralProviderOptions,
  AzureOpenAIProviderOptions
} from "./openai-compatible";
import type { CohereProviderOptions } from "./cohere";
import type { GoogleProviderOptions } from "./google";
import type { AnthropicProviderOptions } from "./anthropic";
import type { VoyageProviderOptions } from "./voyage";
import type { OllamaProviderOptions } from "./ollama";

/** Map of provider name → options type for `createProvider` overloads. */
export interface ProviderOptionsMap {
  openai: OpenAIProviderOptions;
  nvidia: NVIDIAProviderOptions;
  mistral: MistralProviderOptions;
  azure: AzureOpenAIProviderOptions;
  cohere: CohereProviderOptions;
  google: GoogleProviderOptions;
  anthropic: AnthropicProviderOptions;
  voyage: VoyageProviderOptions;
  ollama: OllamaProviderOptions;
}

export type ProviderName = keyof ProviderOptionsMap;

// Overloads for full TypeScript type inference at the call site
export function createProvider(name: "openai",    options: OpenAIProviderOptions):    MemoryProvider;
export function createProvider(name: "nvidia",    options: NVIDIAProviderOptions):    MemoryProvider;
export function createProvider(name: "mistral",   options: MistralProviderOptions):   MemoryProvider;
export function createProvider(name: "azure",     options: AzureOpenAIProviderOptions): MemoryProvider;
export function createProvider(name: "cohere",    options: CohereProviderOptions):    MemoryProvider;
export function createProvider(name: "google",    options: GoogleProviderOptions):    MemoryProvider;
export function createProvider(name: "anthropic", options: AnthropicProviderOptions): MemoryProvider;
export function createProvider(name: "voyage",    options: VoyageProviderOptions):    MemoryProvider;
export function createProvider(name: "ollama",    options?: OllamaProviderOptions):   MemoryProvider;

/**
 * Unified factory for all built-in providers.
 *
 * @example
 * const p = createProvider("openai",    { apiKey: process.env.OPENAI_API_KEY });
 * const p = createProvider("nvidia",    { apiKey: process.env.NVIDIA_API_KEY });
 * const p = createProvider("mistral",   { apiKey: process.env.MISTRAL_API_KEY });
 * const p = createProvider("cohere",    { apiKey: process.env.COHERE_API_KEY });
 * const p = createProvider("google",    { apiKey: process.env.GOOGLE_API_KEY });
 * const p = createProvider("anthropic", { apiKey: process.env.ANTHROPIC_API_KEY });
 * const p = createProvider("voyage",    { apiKey: process.env.VOYAGE_API_KEY });
 * const p = createProvider("ollama");   // no key — uses localhost:11434
 * const p = createProvider("azure", {
 *   apiKey: process.env.AZURE_OPENAI_KEY,
 *   endpoint: "https://my.openai.azure.com",
 *   embeddingDeployment: "text-embedding-3-small",
 *   chatDeployment: "gpt-4o-mini"
 * });
 */
export function createProvider(
  name: ProviderName,
  options?: ProviderOptionsMap[ProviderName]
): MemoryProvider {
  switch (name) {
    case "openai":    return openaiProvider(options as OpenAIProviderOptions);
    case "nvidia":    return nvidiaProvider((options ?? {}) as NVIDIAProviderOptions);
    case "mistral":   return mistralProvider(options as MistralProviderOptions);
    case "azure":     return azureOpenAIProvider(options as AzureOpenAIProviderOptions);
    case "cohere":    return cohereProvider(options as CohereProviderOptions);
    case "google":    return googleProvider(options as GoogleProviderOptions);
    case "anthropic": return anthropicProvider(options as AnthropicProviderOptions);
    case "voyage":    return voyageProvider(options as VoyageProviderOptions);
    case "ollama":    return ollamaProvider((options ?? {}) as OllamaProviderOptions);
    default: {
      // Exhaustiveness guard
      const _never: never = name;
      throw new Error(`[agent-memory] Unknown provider: "${String(_never)}"`);
    }
  }
}

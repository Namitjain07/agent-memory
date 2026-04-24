/**
 * OpenAI-compatible providers: OpenAI, NVIDIA NIM, Mistral, Ollama (OpenAI mode), Azure OpenAI.
 * All share the same `/v1/embeddings` and `/v1/chat/completions` wire format.
 */
import type { SummariseFn } from "../types/config";
import { buildConversationText, buildSummaryPrompt, fetchJSON, type MemoryProvider } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OpenAIProviderOptions {
  /** API key. Required for cloud providers; omit for local Ollama in OpenAI mode. */
  apiKey?: string;
  /** Base URL without trailing slash. Defaults to `https://api.openai.com/v1`. */
  baseURL?: string;
  /** Embedding model. Defaults to `text-embedding-3-small`. */
  embeddingModel?: string;
  /** Chat model used for summarisation. Defaults to `gpt-4o-mini`. */
  chatModel?: string;
  /** Extra headers merged into every request (e.g. `organization`). */
  extraHeaders?: Record<string, string>;
}

export interface NVIDIAProviderOptions extends Omit<OpenAIProviderOptions, "baseURL" | "embeddingModel" | "chatModel"> {
  embeddingModel?: string; // default: nvidia/nv-embedqa-e5-v5
  chatModel?: string;      // default: meta/llama-3.1-8b-instruct
}

export interface MistralProviderOptions extends Omit<OpenAIProviderOptions, "baseURL" | "embeddingModel" | "chatModel"> {
  embeddingModel?: string; // default: mistral-embed
  chatModel?: string;      // default: mistral-small-latest
}

export interface AzureOpenAIProviderOptions {
  /** API key for Azure (`Ocp-Apim-Subscription-Key` / `api-key` header). */
  apiKey: string;
  /** Azure resource endpoint, e.g. `https://my-resource.openai.azure.com`. */
  endpoint: string;
  /** Deployment name for the embedding model. */
  embeddingDeployment: string;
  /** Deployment name for the chat model (used for summarisation). */
  chatDeployment?: string;
  /** Azure OpenAI API version. Defaults to `2024-02-01`. */
  apiVersion?: string;
}

// ─── Internal ────────────────────────────────────────────────────────────────

interface EmbedResponse {
  data: { embedding: number[] }[];
}

interface ChatResponse {
  choices: { message: { content: string } }[];
}

function makeAuthHeaders(apiKey: string | undefined, extra: Record<string, string> = {}): Record<string, string> {
  const auth = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  return { ...auth, ...extra };
}

function makeOpenAICompatible(
  name: string,
  baseURL: string,
  embeddingModel: string,
  chatModel: string,
  headers: Record<string, string>
): MemoryProvider {
  const embedFn = async (text: string): Promise<number[]> => {
    const res = await fetchJSON<EmbedResponse>(
      `${baseURL}/embeddings`,
      { model: embeddingModel, input: text },
      headers
    );
    const first = res.data[0];
    if (!first) throw new Error(`[agent-memory] ${name} embeddings returned no data.`);
    return first.embedding;
  };

  const embedBatchFn = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    const res = await fetchJSON<EmbedResponse>(
      `${baseURL}/embeddings`,
      { model: embeddingModel, input: texts },
      headers
    );
    return res.data.map((d) => d.embedding);
  };

  const summarise: SummariseFn = async ({ entries }) => {
    const res = await fetchJSON<ChatResponse>(
      `${baseURL}/chat/completions`,
      {
        model: chatModel,
        messages: [
          {
            role: "user",
            content: buildSummaryPrompt(entries)
          }
        ],
        max_tokens: 512,
        temperature: 0.3
      },
      headers
    );
    return res.choices[0]?.message.content.trim() ?? buildConversationText(entries);
  };

  return { name, embedFn, embedBatchFn, summarise };
}

// ─── Provider factories ───────────────────────────────────────────────────────

/**
 * OpenAI provider. Requires `apiKey`.
 *
 * @example
 * const provider = openaiProvider({ apiKey: process.env.OPENAI_API_KEY });
 * const memory = new AgentMemory({ embedding: provider });
 */
export function openaiProvider(options: OpenAIProviderOptions): MemoryProvider {
  return makeOpenAICompatible(
    "openai",
    options.baseURL ?? "https://api.openai.com/v1",
    options.embeddingModel ?? "text-embedding-3-small",
    options.chatModel ?? "gpt-4o-mini",
    makeAuthHeaders(options.apiKey, options.extraHeaders)
  );
}

/**
 * NVIDIA NIM provider (OpenAI-compatible).
 *
 * @example
 * const provider = nvidiaProvider({ apiKey: process.env.NVIDIA_API_KEY });
 */
export function nvidiaProvider(options: NVIDIAProviderOptions): MemoryProvider {
  return makeOpenAICompatible(
    "nvidia",
    "https://integrate.api.nvidia.com/v1",
    options.embeddingModel ?? "nvidia/nv-embedqa-e5-v5",
    options.chatModel ?? "meta/llama-3.1-8b-instruct",
    makeAuthHeaders(options.apiKey, options.extraHeaders)
  );
}

/**
 * Mistral AI provider (OpenAI-compatible).
 *
 * @example
 * const provider = mistralProvider({ apiKey: process.env.MISTRAL_API_KEY });
 */
export function mistralProvider(options: MistralProviderOptions): MemoryProvider {
  return makeOpenAICompatible(
    "mistral",
    "https://api.mistral.ai/v1",
    options.embeddingModel ?? "mistral-embed",
    options.chatModel ?? "mistral-small-latest",
    makeAuthHeaders(options.apiKey, options.extraHeaders)
  );
}

/**
 * Azure OpenAI provider. Uses deployment-based URLs and `api-key` header.
 *
 * @example
 * const provider = azureOpenAIProvider({
 *   apiKey: process.env.AZURE_OPENAI_KEY,
 *   endpoint: "https://my-resource.openai.azure.com",
 *   embeddingDeployment: "text-embedding-3-small",
 *   chatDeployment: "gpt-4o-mini"
 * });
 */
export function azureOpenAIProvider(options: AzureOpenAIProviderOptions): MemoryProvider {
  const apiVersion = options.apiVersion ?? "2024-02-01";
  const endpoint = options.endpoint.replace(/\/$/, "");
  const headers = { "api-key": options.apiKey };

  const embedURL = `${endpoint}/openai/deployments/${options.embeddingDeployment}/embeddings?api-version=${apiVersion}`;
  const chatURL = options.chatDeployment
    ? `${endpoint}/openai/deployments/${options.chatDeployment}/chat/completions?api-version=${apiVersion}`
    : null;

  const embedFn = async (text: string): Promise<number[]> => {
    const res = await fetchJSON<EmbedResponse>(embedURL, { input: text }, headers);
    const first = res.data[0];
    if (!first) throw new Error("[agent-memory] Azure OpenAI embeddings returned no data.");
    return first.embedding;
  };

  const embedBatchFn = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    const res = await fetchJSON<EmbedResponse>(embedURL, { input: texts }, headers);
    return res.data.map((d) => d.embedding);
  };

  const summarise: SummariseFn | undefined = chatURL
    ? async ({ entries }) => {
        const res = await fetchJSON<ChatResponse>(
          chatURL,
          {
            messages: [{ role: "user", content: buildSummaryPrompt(entries) }],
            max_tokens: 512,
            temperature: 0.3
          },
          headers
        );
        return res.choices[0]?.message.content.trim() ?? buildConversationText(entries);
      }
    : undefined;

  const provider: MemoryProvider = {
    name: "azure",
    embedFn,
    embedBatchFn
  };

  if (summarise) {
    provider.summarise = summarise;
  }

  return provider;
}

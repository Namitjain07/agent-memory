/**
 * Ollama provider — local LLM serving via the Ollama REST API.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 *
 * No API key required. Ollama must be running locally (or at a custom URL).
 */
import type { SummariseFn } from "../types/config";
import { buildSummaryPrompt, buildConversationText, fetchJSON, type MemoryProvider } from "./types";
import type { RequestOptions } from "../utils/http";
import { DEFAULT_RETRY_POLICY } from "../utils/http";

export interface OllamaProviderOptions {
  /** Ollama server URL. Defaults to `http://localhost:11434`. */
  baseURL?: string;
  /** Model for embeddings. Defaults to `nomic-embed-text`. */
  embeddingModel?: string;
  /** Model for chat / summarisation. Defaults to `llama3.2`. */
  chatModel?: string;
  /** Default per-request options: timeout, retry, abort signal. */
  requestOptions?: RequestOptions;
}

interface OllamaEmbedResponse {
  embeddings: number[][];
}

interface OllamaChatResponse {
  message: { content: string };
}

/**
 * Ollama local provider. No API key required.
 *
 * @example
 * // Run `ollama pull nomic-embed-text && ollama pull llama3.2` first.
 * const provider = ollamaProvider();
 * const memory = new AgentMemory({ embedding: provider });
 */
export function ollamaProvider(options: OllamaProviderOptions = {}): MemoryProvider {
  const base = options.baseURL?.replace(/\/$/, "") ?? "http://localhost:11434";
  const embeddingModel = options.embeddingModel ?? "nomic-embed-text";
  const chatModel = options.chatModel ?? "llama3.2";
  const headers = {};
  const requestOptions = options.requestOptions;

  const embedBatch = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    // Ollama /api/embed accepts a single string or array as `input`
    const res = await fetchJSON<OllamaEmbedResponse>(
      `${base}/api/embed`,
      { model: embeddingModel, input: texts },
      headers,
      {
        ...DEFAULT_RETRY_POLICY,
        ...(requestOptions ?? {}),
        context: "ollama embed-batch"
      }
    );
    return res.embeddings;
  };

  const embedFn = async (text: string): Promise<number[]> => {
    const [vec] = await embedBatch([text]);
    if (!vec) throw new Error("[agent-memory] Ollama embeddings returned no data.");
    return vec;
  };

  const summarise: SummariseFn = async ({ entries }) => {
    const res = await fetchJSON<OllamaChatResponse>(
      `${base}/api/chat`,
      {
        model: chatModel,
        messages: [{ role: "user", content: buildSummaryPrompt(entries) }],
        stream: false,
        options: { temperature: 0.3 }
      },
      headers,
      {
        ...DEFAULT_RETRY_POLICY,
        ...(requestOptions ?? {}),
        context: "ollama summarise"
      }
    );
    return res.message?.content?.trim() ?? buildConversationText(entries);
  };

  const provider: MemoryProvider = {
    name: "ollama",
    embedFn,
    embedBatchFn: embedBatch,
    summarise
  };
  if (requestOptions) provider.defaultRequestOptions = requestOptions;
  return provider;
}

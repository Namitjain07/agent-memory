/**
 * Cohere provider — embed + chat using Cohere's v2 REST API.
 * Docs: https://docs.cohere.com/reference/embed
 */
import type { SummariseFn } from "../types/config";
import { buildSummaryPrompt, buildConversationText, fetchJSON, type MemoryProvider } from "./types";
import type { RequestOptions } from "../utils/http";
import { DEFAULT_RETRY_POLICY } from "../utils/http";

export interface CohereProviderOptions {
  apiKey: string;
  /** Embedding model. Defaults to `embed-english-v3.0`. */
  embeddingModel?: string;
  /** Chat model used for summarisation. Defaults to `command-r-plus`. */
  chatModel?: string;
  /**
   * Embedding input type.
   * Use `"search_query"` for queries, `"search_document"` for stored text.
   * Defaults to `"search_document"`.
   */
  inputType?: "search_document" | "search_query" | "classification" | "clustering";
  baseURL?: string;
  /** Default per-request options: timeout, retry, abort signal. */
  requestOptions?: RequestOptions;
}

interface CohereEmbedResponse {
  embeddings: { float: number[][] };
}

interface CohereChatResponse {
  message: { content: { type: string; text: string }[] };
}

/**
 * Cohere provider. Supports embeddings + summarisation.
 *
 * @example
 * const provider = cohereProvider({ apiKey: process.env.COHERE_API_KEY });
 * const memory = new AgentMemory({ embedding: provider });
 */
export function cohereProvider(options: CohereProviderOptions): MemoryProvider {
  const base = options.baseURL?.replace(/\/$/, "") ?? "https://api.cohere.com/v2";
  const embeddingModel = options.embeddingModel ?? "embed-english-v3.0";
  const chatModel = options.chatModel ?? "command-r-plus";
  const inputType = options.inputType ?? "search_document";
  const headers = { Authorization: `Bearer ${options.apiKey}` };
  const requestOptions = options.requestOptions;

  const embedBatch = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    const res = await fetchJSON<CohereEmbedResponse>(
      `${base}/embed`,
      {
        model: embeddingModel,
        texts,
        input_type: inputType,
        embedding_types: ["float"]
      },
      headers,
      {
        ...DEFAULT_RETRY_POLICY,
        ...(requestOptions ?? {}),
        context: "cohere embed-batch"
      }
    );
    return res.embeddings.float;
  };

  const embedFn = async (text: string): Promise<number[]> => {
    const [vec] = await embedBatch([text]);
    if (!vec) throw new Error("[agent-memory] Cohere embeddings returned no data.");
    return vec;
  };

  const summarise: SummariseFn = async ({ entries }) => {
    const res = await fetchJSON<CohereChatResponse>(
      `${base}/chat`,
      {
        model: chatModel,
        messages: [{ role: "user", content: buildSummaryPrompt(entries) }],
        max_tokens: 512,
        temperature: 0.3
      },
      headers,
      {
        ...DEFAULT_RETRY_POLICY,
        ...(requestOptions ?? {}),
        context: "cohere summarise"
      }
    );
    const text = res.message?.content?.find((c) => c.type === "text")?.text;
    return text?.trim() ?? buildConversationText(entries);
  };

  const provider: MemoryProvider = {
    name: "cohere",
    embedFn,
    embedBatchFn: embedBatch,
    summarise
  };
  if (requestOptions) provider.defaultRequestOptions = requestOptions;
  return provider;
}

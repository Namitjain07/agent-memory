/**
 * Voyage AI provider — embeddings only (Voyage has no chat API).
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 */
import { fetchJSON, type MemoryProvider } from "./types";

export interface VoyageProviderOptions {
  apiKey: string;
  /** Embedding model. Defaults to `voyage-3`. */
  model?: string;
  /**
   * Input type hint for the model.
   * Use `"query"` when embedding a search query, `"document"` for stored text.
   * Defaults to `"document"`.
   */
  inputType?: "query" | "document";
  baseURL?: string;
}

interface VoyageEmbedResponse {
  data: { embedding: number[] }[];
}

/**
 * Voyage AI provider. Embeddings only — no chat/summarise.
 *
 * @example
 * const provider = voyageProvider({ apiKey: process.env.VOYAGE_API_KEY });
 * const memory = new AgentMemory({ embedding: provider });
 */
export function voyageProvider(options: VoyageProviderOptions): MemoryProvider {
  const base = options.baseURL?.replace(/\/$/, "") ?? "https://api.voyageai.com/v1";
  const model = options.model ?? "voyage-3";
  const inputType = options.inputType ?? "document";
  const headers = { Authorization: `Bearer ${options.apiKey}` };

  const embedBatch = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    const res = await fetchJSON<VoyageEmbedResponse>(
      `${base}/embeddings`,
      { model, input: texts, input_type: inputType },
      headers
    );
    return res.data.map((d) => d.embedding);
  };

  const embedFn = async (text: string): Promise<number[]> => {
    const [vec] = await embedBatch([text]);
    if (!vec) throw new Error("[agent-memory] Voyage embeddings returned no data.");
    return vec;
  };

  return {
    name: "voyage",
    embedFn,
    embedBatchFn: embedBatch
    // No summarise — Voyage is an embeddings-only service
  };
}

/**
 * Google Gemini provider — embed + chat via Google's Generative Language REST API.
 * Docs: https://ai.google.dev/api/embeddings
 */
import type { SummariseFn } from "../types/config";
import { buildSummaryPrompt, buildConversationText, fetchJSON, type MemoryProvider } from "./types";
import type { RequestOptions } from "../utils/http";
import { DEFAULT_RETRY_POLICY } from "../utils/http";

export interface GoogleProviderOptions {
  apiKey: string;
  /** Embedding model. Defaults to `text-embedding-004`. */
  embeddingModel?: string;
  /** Chat model used for summarisation. Defaults to `gemini-1.5-flash`. */
  chatModel?: string;
  baseURL?: string;
  /** Default per-request options: timeout, retry, abort signal. */
  requestOptions?: RequestOptions;
}

interface GeminiEmbedResponse {
  embedding: { values: number[] };
}

interface GeminiBatchEmbedResponse {
  embeddings: { values: number[] }[];
}

interface GeminiGenerateResponse {
  candidates: {
    content: { parts: { text: string }[] };
  }[];
}

/**
 * Google Gemini provider. Supports embeddings + summarisation.
 *
 * @example
 * const provider = googleProvider({ apiKey: process.env.GOOGLE_API_KEY });
 * const memory = new AgentMemory({ embedding: provider });
 */
export function googleProvider(options: GoogleProviderOptions): MemoryProvider {
  const base = options.baseURL?.replace(/\/$/, "") ?? "https://generativelanguage.googleapis.com/v1beta";
  const embeddingModel = options.embeddingModel ?? "text-embedding-004";
  const chatModel = options.chatModel ?? "gemini-1.5-flash";
  const key = options.apiKey;
  const headers = {}; // auth is via ?key= query param for Google
  const requestOptions = options.requestOptions;

  const embedFn = async (text: string): Promise<number[]> => {
    const url = `${base}/models/${embeddingModel}:embedContent?key=${key}`;
    const res = await fetchJSON<GeminiEmbedResponse>(url, { content: { parts: [{ text }] } }, headers, {
      ...DEFAULT_RETRY_POLICY,
      ...(requestOptions ?? {}),
      context: "google embed"
    });
    return res.embedding.values;
  };

  const embedBatchFn = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    const url = `${base}/models/${embeddingModel}:batchEmbedContents?key=${key}`;
    const res = await fetchJSON<GeminiBatchEmbedResponse>(
      url,
      {
        requests: texts.map((text) => ({
          model: `models/${embeddingModel}`,
          content: { parts: [{ text }] }
        }))
      },
      headers,
      {
        ...DEFAULT_RETRY_POLICY,
        ...(requestOptions ?? {}),
        context: "google embed-batch"
      }
    );
    return res.embeddings.map((e) => e.values);
  };

  const summarise: SummariseFn = async ({ entries }) => {
    const url = `${base}/models/${chatModel}:generateContent?key=${key}`;
    const res = await fetchJSON<GeminiGenerateResponse>(
      url,
      {
        contents: [{ parts: [{ text: buildSummaryPrompt(entries) }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.3 }
      },
      headers,
      {
        ...DEFAULT_RETRY_POLICY,
        ...(requestOptions ?? {}),
        context: "google summarise"
      }
    );
    const text = res.candidates[0]?.content?.parts[0]?.text;
    return text?.trim() ?? buildConversationText(entries);
  };

  const provider: MemoryProvider = {
    name: "google",
    embedFn,
    embedBatchFn,
    summarise
  };
  if (requestOptions) provider.defaultRequestOptions = requestOptions;
  return provider;
}

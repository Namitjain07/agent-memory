import type { EmbedBatchFn, EmbedFn } from "../types/config";

/**
 * Create a batch embed function that wraps a single-text embed function.
 * Processes items in parallel (or sequentially by chunk if batchSize is set).
 *
 * @example
 * const batchEmbed = createBatchEmbedFn(myEmbedFn, 20);
 */
export function createBatchEmbedFn(
  embedFn: EmbedFn,
  batchSize: number = 20
): EmbedBatchFn {
  return async (texts: string[]): Promise<number[][]> => {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const chunk = texts.slice(i, i + batchSize);
      const chunkResults = await Promise.all(chunk.map((t) => embedFn(t)));
      results.push(...chunkResults);
    }
    return results;
  };
}

/**
 * Create an OpenAI-compatible embed function.
 * Works with any client implementing the OpenAI Embeddings API
 * (OpenAI SDK, Azure OpenAI, NVIDIA NIM, etc.).
 *
 * @example
 * import OpenAI from "openai";
 * const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * const embedFn = createOpenAIEmbedFn(client, "text-embedding-3-small");
 */
export function createOpenAIEmbedFn(
  client: {
    embeddings: {
      create: (params: {
        model: string;
        input: string | string[];
      }) => Promise<{ data: { embedding: number[] }[] }>;
    };
  },
  model: string = "text-embedding-3-small"
): EmbedFn {
  return async (text: string): Promise<number[]> => {
    const response = await client.embeddings.create({ model, input: text });
    const first = response.data[0];
    if (!first) {
      throw new Error("[agent-memory] OpenAI embeddings returned no data.");
    }
    return first.embedding;
  };
}

/**
 * Create a batch OpenAI-compatible embed function.
 * Sends all texts in a single API call for maximum efficiency.
 *
 * @example
 * const batchEmbed = createOpenAIBatchEmbedFn(client, "text-embedding-3-small");
 */
export function createOpenAIBatchEmbedFn(
  client: {
    embeddings: {
      create: (params: {
        model: string;
        input: string | string[];
      }) => Promise<{ data: { embedding: number[] }[] }>;
    };
  },
  model: string = "text-embedding-3-small"
): EmbedBatchFn {
  return async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    const response = await client.embeddings.create({ model, input: texts });
    return response.data.map((d) => d.embedding);
  };
}

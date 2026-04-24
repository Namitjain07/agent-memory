/**
 * Anthropic provider — summarisation only (Anthropic has no public embeddings API).
 * Docs: https://docs.anthropic.com/en/api/messages
 */
import type { SummariseFn } from "../types/config";
import { buildSummaryPrompt, buildConversationText, fetchJSON, type MemoryProvider } from "./types";

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Chat model. Defaults to `claude-3-5-haiku-20241022`. */
  model?: string;
  baseURL?: string;
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
}

/**
 * Anthropic Claude provider.
 *
 * > **Note**: Anthropic does not offer a public embeddings API.
 * > This provider only supplies `summarise`. For embeddings, pair with
 * > another provider's `embedFn`:
 *
 * ```ts
 * const embed = openaiProvider({ apiKey: process.env.OPENAI_API_KEY });
 * const summarizer = anthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * const memory = new AgentMemory({
 *   embedding: embed,
 *   summarisation: { summariseFn: summarizer.summarise }
 * });
 * ```
 *
 * If you create a full `AgentMemory` with just the Anthropic provider, a
 * no-op embed fallback is installed so the object is still valid; recall will
 * work via recency + importance scoring.
 */
export function anthropicProvider(options: AnthropicProviderOptions): MemoryProvider {
  const base = options.baseURL?.replace(/\/$/, "") ?? "https://api.anthropic.com/v1";
  const model = options.model ?? "claude-3-5-haiku-20241022";
  const headers = {
    "x-api-key": options.apiKey,
    "anthropic-version": "2023-06-01"
  };

  const summarise: SummariseFn = async ({ entries }) => {
    const res = await fetchJSON<AnthropicResponse>(
      `${base}/messages`,
      {
        model,
        max_tokens: 512,
        messages: [{ role: "user", content: buildSummaryPrompt(entries) }]
      },
      headers
    );
    const text = res.content.find((c) => c.type === "text")?.text;
    return text?.trim() ?? buildConversationText(entries);
  };

  // No-op embed fns — Anthropic has no embeddings API.
  // Recall will work via recency + importance when no real vectors are present.
  const noopEmbed = async (_text: string): Promise<number[]> => [];
  const noopBatch = async (texts: string[]): Promise<number[][]> => texts.map(() => []);

  return {
    name: "anthropic",
    embedFn: noopEmbed,
    embedBatchFn: noopBatch,
    summarise
  };
}

import type { EmbedBatchFn, EmbedFn, SummariseFn } from "../types/config";
import type { MemoryEntry } from "../types/memory";

/**
 * A MemoryProvider bundles an embedding function pair and an optional
 * LLM-based summarisation function into a single object.
 *
 * Because it exposes `embedFn` and `embedBatchFn` it satisfies
 * `EmbeddingConfig` directly:
 *
 * ```ts
 * const provider = createProvider("openai", { apiKey: "..." });
 *
 * const memory = new AgentMemory({
 *   embedding: provider,            // ← works without extra wiring
 *   summarisation: {
 *     summariseFn: provider.summarise
 *   }
 * });
 * ```
 */
export interface MemoryProvider {
  /** Provider identifier (e.g. "openai", "cohere"). */
  name: string;
  embedFn: EmbedFn;
  embedBatchFn: EmbedBatchFn;
  /**
   * LLM-based summarisation function.
   * Undefined for providers that don't support text generation (e.g. Voyage).
   */
  summarise?: SummariseFn;
}

// ─── Shared internal helpers ─────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT =
  "You are a conversation summarizer. Summarize the following conversation " +
  "concisely, preserving all key facts, preferences, names, and important context. " +
  "Be specific. Return only the summary, no preamble or explanation.";

export function buildConversationText(entries: MemoryEntry[]): string {
  return entries
    .map((e) => `${e.role.toUpperCase()}: ${e.content.trim()}`)
    .join("\n");
}

export function buildSummaryPrompt(entries: MemoryEntry[]): string {
  return `${SUMMARY_SYSTEM_PROMPT}\n\n---\n${buildConversationText(entries)}\n---\n\nSummary:`;
}

export async function fetchJSON<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(`[agent-memory] Provider request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

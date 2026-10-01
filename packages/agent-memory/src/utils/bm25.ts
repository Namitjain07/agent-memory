/**
 * Lightweight BM25 keyword scoring for hybrid vector + keyword search.
 *
 * Pure JS, zero dependencies, edge-friendly. Not a full Lucene replacement —
 * just a simple term-frequency scorer suitable for short memory snippets.
 *
 * Default BM25 parameters (k1, b) are tuned for short documents (~5-50 tokens).
 *
 * @see https://en.wikipedia.org/wiki/Okapi_BM25
 */

import type { MemoryItem } from "../types/memory";

export interface BM25Options {
  /** BM25 k1 parameter — term frequency saturation. Default: 1.5. */
  k1?: number;
  /** BM25 b parameter — document length normalisation. Default: 0.75. */
  b?: number;
}

const DEFAULT_K1 = 1.5;
const DEFAULT_B = 0.75;

const TOKEN_RE = /[A-Za-z0-9]+/g;

/** Tokenise a string into lowercase word tokens. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) ?? []);
}

/** Average document length across a corpus of items. */
function averageLength(items: MemoryItem[]): number {
  if (items.length === 0) return 0;
  let total = 0;
  for (const item of items) {
    const text = itemContent(item);
    total += tokenize(text).length;
  }
  return total / items.length;
}

function itemContent(item: MemoryItem): string {
  return item.kind === "fact" ? `${item.key} ${item.value} ${item.content}` : item.content;
}

/**
 * Compute a per-item BM25 score against a query, given the full corpus.
 * Returns a map of itemId → score (0..1, normalised).
 */
export function bm25Scores(
  query: string,
  items: MemoryItem[],
  options: BM25Options = {}
): Map<string, number> {
  const k1 = options.k1 ?? DEFAULT_K1;
  const b = options.b ?? DEFAULT_B;
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return new Map();

  const avgDL = averageLength(items);
  if (avgDL === 0) return new Map();

  // Document frequencies
  const df = new Map<string, number>();
  for (const item of items) {
    const seen = new Set<string>();
    for (const token of tokenize(itemContent(item))) {
      if (seen.has(token)) continue;
      seen.add(token);
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const N = items.length;

  // Per-item scores
  const raw = new Map<string, number>();
  for (const item of items) {
    const tokens = tokenize(itemContent(item));
    const dl = tokens.length;
    if (dl === 0) {
      raw.set(item.id, 0);
      continue;
    }
    // Term frequency in this doc
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    let score = 0;
    for (const qt of queryTokens) {
      const f = tf.get(qt) ?? 0;
      if (f === 0) continue;
      const n = df.get(qt) ?? 0;
      // IDF with smoothing to avoid negative scores
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const normalised = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgDL)));
      score += idf * normalised;
    }
    raw.set(item.id, score);
  }

  // Normalise to [0, 1]
  let max = 0;
  for (const v of raw.values()) if (v > max) max = v;
  const out = new Map<string, number>();
  if (max === 0) return out;
  for (const [id, v] of raw) out.set(id, v / max);
  return out;
}

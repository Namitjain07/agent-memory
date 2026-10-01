/**
 * Memory operations: deduplication, merging, and similarity helpers
 * that work on top of vector embeddings.
 *
 * These utilities are dependency-free and adapter-agnostic — they
 * operate on `MemoryItem` arrays.
 */

import { cosineSimilarity } from "./math";
import type { MemoryEntry, MemoryFact, MemoryItem } from "../types/memory";

export interface DedupOptions {
  /** Cosine similarity above which two items are considered duplicates. Default: 0.92. */
  threshold?: number;
  /** Only consider items of these kinds. Default: ["fact"]. */
  kinds?: Array<"fact" | "entry">;
  /** When duplicates are found, keep the newer item (by `timestamp`). Default: true. */
  preferNewer?: boolean;
}

const DEFAULT_THRESHOLD = 0.92;

/**
 * Remove near-duplicate memory items from a list, keeping the most recent
 * (or oldest) of each similarity cluster.
 *
 * Useful for cleaning up a session before summarisation, or as part of
 * a periodic "memory hygiene" job.
 */
export function deduplicateSimilarFacts(items: MemoryItem[], options: DedupOptions = {}): MemoryItem[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const kinds = options.kinds ?? (["fact"] as const);
  const preferNewer = options.preferNewer ?? true;

  const candidates = items.filter((item) => kinds.includes(item.kind as "fact" | "entry"));
  const others = items.filter((item) => !kinds.includes(item.kind as "fact" | "entry"));

  const withEmbedding = candidates.filter((item): item is MemoryItem & { embedding: number[] } =>
    Boolean(item.embedding && item.embedding.length > 0)
  );
  const withoutEmbedding = candidates.filter((item) => !(item.embedding && item.embedding.length > 0));

  const keep: MemoryItem[] = [];
  const drop = new Set<string>();

  for (let i = 0; i < withEmbedding.length; i += 1) {
    const a = withEmbedding[i]!;
    if (drop.has(a.id)) continue;
    keep.push(a);
    for (let j = i + 1; j < withEmbedding.length; j += 1) {
      const b = withEmbedding[j]!;
      if (drop.has(b.id)) continue;
      if (a.embedding.length !== b.embedding.length) continue;
      const sim = cosineSimilarity(a.embedding, b.embedding);
      if (sim >= threshold) {
        const loser = preferNewer ? (a.timestamp >= b.timestamp ? b : a) : a.timestamp <= b.timestamp ? b : a;
        drop.add(loser.id);
        // If the loser is the existing "keep" candidate, swap
        if (loser.id === a.id) {
          const idx = keep.indexOf(a);
          if (idx !== -1) keep[idx] = b;
        }
      }
    }
  }

  return [...keep, ...withoutEmbedding, ...others];
}

export interface MergeOptions {
  /** Cosine similarity above which two items are considered duplicates. Default: 0.92. */
  threshold?: number;
  /** Combine `importance` by taking the max of merged items. Default: true. */
  importanceByMax?: boolean;
}

function mergeFact(a: MemoryFact, b: MemoryFact, options: MergeOptions): MemoryFact {
  const importanceByMax = options.importanceByMax ?? true;
  return {
    ...a,
    value: a.value === b.value ? a.value : `${a.value}; ${b.value}`,
    timestamp: Math.max(a.timestamp, b.timestamp),
    importance: importanceByMax ? Math.max(a.importance, b.importance) : (a.importance + b.importance) / 2
  };
}

function mergeEntry(a: MemoryEntry, b: MemoryEntry, options: MergeOptions): MemoryEntry {
  const importanceByMax = options.importanceByMax ?? true;
  return {
    ...a,
    content: a.content === b.content ? a.content : `${a.content}\n${b.content}`,
    timestamp: Math.max(a.timestamp, b.timestamp),
    importance: importanceByMax ? Math.max(a.importance, b.importance) : (a.importance + b.importance) / 2
  };
}

/**
 * Merge near-duplicate items into a single item, combining their content
 * (for entries) or value (for facts). The merged item keeps the latest
 * timestamp and the max importance.
 */
export function mergeSimilarEntries(items: MemoryItem[], options: MergeOptions = {}): MemoryItem[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const result: MemoryItem[] = [];

  for (const item of items) {
    const existingIdx = result.findIndex((other) => {
      if (other.kind !== item.kind) return false;
      if (!other.embedding || !item.embedding) return false;
      if (other.embedding.length !== item.embedding.length) return false;
      return cosineSimilarity(other.embedding, item.embedding) >= threshold;
    });

    if (existingIdx === -1) {
      result.push(item);
      continue;
    }

    const existing = result[existingIdx]!;
    if (existing.kind === "fact" && item.kind === "fact") {
      result[existingIdx] = mergeFact(existing, item, options);
    } else if (existing.kind === "entry" && item.kind === "entry") {
      result[existingIdx] = mergeEntry(existing, item, options);
    } else {
      // Kind mismatch — keep both.
      result.push(item);
    }
  }

  return result;
}

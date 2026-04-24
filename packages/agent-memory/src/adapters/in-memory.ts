import type {
  MemoryAdapter,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate
} from "../types/adapter";
import type { MemoryItem } from "../types/memory";
import { cosineSimilarity, normalizeSimilarity } from "../utils/math";

/**
 * In-memory adapter backed by stable Maps.
 * Uses a `Map<id, MemoryItem>` as primary store and a `Map<sessionId, Set<id>>`
 * for session grouping — no fragile index arithmetic.
 */
export class InMemoryAdapter implements MemoryAdapter {
  /** Primary store: id → item */
  private readonly store = new Map<string, MemoryItem>();

  /** Session index: sessionId → ordered list of ids (insertion order) */
  private readonly sessionIndex = new Map<string, string[]>();

  async add(item: MemoryItem): Promise<void> {
    this.store.set(item.id, { ...item });

    const ids = this.sessionIndex.get(item.sessionId) ?? [];
    ids.push(item.id);
    this.sessionIndex.set(item.sessionId, ids);
  }

  async search(
    queryVector: number[],
    options: MemorySearchOptions
  ): Promise<MemorySearchCandidate[]> {
    const ids = this.sessionIndex.get(options.sessionId) ?? [];
    const items: MemoryItem[] = [];

    for (const id of ids) {
      const item = this.store.get(id);
      if (!item) continue;
      if (options.kinds && !options.kinds.includes(item.kind)) continue;
      items.push(item);
    }

    const scored = items
      .map((item) => {
        const similarity =
          item.embedding && item.embedding.length === queryVector.length
            ? normalizeSimilarity(cosineSimilarity(queryVector, item.embedding))
            : 0;
        return { item: { ...item }, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const limit = options.limit ?? scored.length;
    return scored.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    const item = this.store.get(id);
    if (!item) return;

    this.store.delete(id);

    const ids = this.sessionIndex.get(item.sessionId);
    if (ids) {
      const idx = ids.indexOf(id);
      if (idx !== -1) ids.splice(idx, 1);
    }
  }

  async update(id: string, data: MemoryUpdate): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;

    this.store.set(id, { ...existing, ...data } as MemoryItem);
  }

  async getBySession(sessionId: string): Promise<MemoryItem[]> {
    const ids = this.sessionIndex.get(sessionId) ?? [];
    const items: MemoryItem[] = [];

    for (const id of ids) {
      const item = this.store.get(id);
      if (item) items.push({ ...item });
    }

    return items.sort((a, b) => a.timestamp - b.timestamp);
  }

  async clear(sessionId: string): Promise<void> {
    const ids = this.sessionIndex.get(sessionId) ?? [];
    for (const id of ids) {
      this.store.delete(id);
    }
    this.sessionIndex.delete(sessionId);
  }
}

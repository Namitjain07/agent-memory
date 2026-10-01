/**
 * Simple bounded LRU cache for embeddings.
 *
 * Avoids re-embedding identical text within the same process — saves
 * API cost when the same query is recalled repeatedly, or when the same
 * fact is mentioned by many sessions.
 *
 * Uses a `Map` for O(1) insertion and recency tracking (Maps preserve
 * insertion order, so we delete + re-set to move an item to the back).
 */

export class LRU<K, V> {
  private readonly maxSize: number;
  private readonly map = new Map<K, V>();

  constructor(maxSize: number = 1_000) {
    if (maxSize < 1) throw new Error("[agent-memory] LRU maxSize must be >= 1");
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    // Move to back (most recently used)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest (first inserted)
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

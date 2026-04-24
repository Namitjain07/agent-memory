import type {
  MemoryAdapter,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate
} from "../types/adapter";
import type { MemoryItem } from "../types/memory";
import { cosineSimilarity, normalizeSimilarity } from "../utils/math";

export class InMemoryAdapter implements MemoryAdapter {
  private readonly bySession = new Map<string, MemoryItem[]>();

  private readonly byId = new Map<string, { sessionId: string; index: number }>();

  async add(item: MemoryItem): Promise<void> {
    const sessionItems = this.bySession.get(item.sessionId) ?? [];
    sessionItems.push({ ...item });
    this.bySession.set(item.sessionId, sessionItems);
    this.byId.set(item.id, {
      sessionId: item.sessionId,
      index: sessionItems.length - 1
    });
  }

  async search(
    queryVector: number[],
    options: MemorySearchOptions
  ): Promise<MemorySearchCandidate[]> {
    const items = (this.bySession.get(options.sessionId) ?? []).filter((item) =>
      options.kinds ? options.kinds.includes(item.kind) : true
    );

    const scored = items
      .map((item) => {
        const similarity = item.embedding
          ? normalizeSimilarity(cosineSimilarity(queryVector, item.embedding))
          : 0;
        return {
          item: { ...item },
          similarity
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const limit = options.limit ?? scored.length;
    return scored.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    const location = this.byId.get(id);
    if (!location) {
      return;
    }

    const sessionItems = this.bySession.get(location.sessionId);
    if (!sessionItems) {
      this.byId.delete(id);
      return;
    }

    sessionItems.splice(location.index, 1);
    this.byId.delete(id);

    for (let i = location.index; i < sessionItems.length; i += 1) {
      this.byId.set(sessionItems[i]!.id, {
        sessionId: location.sessionId,
        index: i
      });
    }
  }

  async update(id: string, data: MemoryUpdate): Promise<void> {
    const location = this.byId.get(id);
    if (!location) {
      return;
    }

    const sessionItems = this.bySession.get(location.sessionId);
    if (!sessionItems) {
      return;
    }

    const existing = sessionItems[location.index];
    if (!existing) {
      return;
    }

    sessionItems[location.index] = {
      ...existing,
      ...data
    } as MemoryItem;
  }

  async getBySession(sessionId: string): Promise<MemoryItem[]> {
    const items = this.bySession.get(sessionId) ?? [];
    return items
      .map((item) => ({ ...item }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}

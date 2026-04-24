import type { MemoryItem, MemoryKind, MemoryRole } from "./memory";

export interface MemorySearchOptions {
  sessionId: string;
  limit?: number;
  kinds?: MemoryKind[];
}

export interface MemorySearchCandidate {
  item: MemoryItem;
  similarity?: number;
}

export interface MemoryUpdate {
  role?: MemoryRole;
  content?: string;
  key?: string;
  value?: string;
  importance?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  timestamp?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  replacedEntryIds?: string[];
}

export interface MemoryAdapter {
  add(item: MemoryItem): Promise<void>;
  search(
    queryVector: number[],
    options: MemorySearchOptions
  ): Promise<MemorySearchCandidate[]>;
  delete(id: string): Promise<void>;
  update(id: string, data: MemoryUpdate): Promise<void>;
  getBySession(sessionId: string): Promise<MemoryItem[]>;
}

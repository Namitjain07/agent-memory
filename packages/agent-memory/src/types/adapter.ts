import type { MemoryItem, MemoryKind, MemoryRole, MemoryTier } from "./memory";

export interface MemorySearchOptions {
  sessionId: string;
  limit?: number;
  kinds?: MemoryKind[];
  /** Restrict results to specific tiers. Undefined = all tiers. */
  tiers?: MemoryTier[];
  /** Restrict to a specific user id (only matches items with `tier === "user"`). */
  userId?: string;
  /** Restrict to a specific agent id (only matches items with `tier === "agent"`). */
  agentId?: string;
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
  tier?: MemoryTier;
  userId?: string;
  agentId?: string;
}

export interface MemoryAdapter {
  add(item: MemoryItem): Promise<void>;
  search(queryVector: number[], options: MemorySearchOptions): Promise<MemorySearchCandidate[]>;
  delete(id: string): Promise<void>;
  update(id: string, data: MemoryUpdate): Promise<void>;
  getBySession(sessionId: string): Promise<MemoryItem[]>;
  /**
   * Optional — clear all memory items for a session.
   * Adapters that can do this more efficiently than per-item deletion
   * should implement it. If omitted, the AgentMemory falls back to
   * iterating getBySession and calling delete() per item.
   */
  clear?(sessionId: string): Promise<void>;
}

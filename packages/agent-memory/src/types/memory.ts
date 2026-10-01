export type MemoryRole = "system" | "user" | "assistant" | "tool";
export type MemoryKind = "entry" | "fact" | "summary";

/**
 * A memory tier is a logical scope for memories, similar to mem0's
 * user / agent / session tiers.
 *
 * - `user`   — long-term facts about an end-user (preferences, profile)
 * - `agent`  — agent persona / behaviour / learned instructions
 * - `session` — per-conversation context (default if omitted)
 */
export type MemoryTier = "user" | "agent" | "session";

export interface BaseMemoryItem {
  id: string;
  kind: MemoryKind;
  sessionId: string;
  /** Optional user/agent tier. Defaults to "session" when omitted. */
  tier?: MemoryTier;
  /** Optional explicit user id. When `tier === "user"`, this is the canonical key. */
  userId?: string;
  /** Optional explicit agent id. When `tier === "agent"`, this is the canonical key. */
  agentId?: string;
  timestamp: number;
  importance: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface MemoryEntry extends BaseMemoryItem {
  kind: "entry";
  role: MemoryRole;
  content: string;
}

export interface MemoryFact extends BaseMemoryItem {
  kind: "fact";
  key: string;
  value: string;
  content: string;
}

export interface MemorySummary extends BaseMemoryItem {
  kind: "summary";
  content: string;
  fromTimestamp: number;
  toTimestamp: number;
  replacedEntryIds: string[];
}

export type MemoryItem = MemoryEntry | MemoryFact | MemorySummary;

export interface MemoryMessage {
  role: MemoryRole | "system";
  content: string;
  name?: string;
}

export interface MemoryStats {
  total: number;
  byKind: Record<MemoryKind, number>;
  byTier?: Partial<Record<MemoryTier, number>>;
  sessionIds: string[];
  userIds?: string[];
  agentIds?: string[];
}

export type MemoryRole = "system" | "user" | "assistant" | "tool";
export type MemoryKind = "entry" | "fact" | "summary";

export interface BaseMemoryItem {
  id: string;
  kind: MemoryKind;
  sessionId: string;
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

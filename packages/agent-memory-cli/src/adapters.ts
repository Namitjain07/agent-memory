/**
 * Open a read-only adapter for a SQLite database file.
 * Uses a thin duck-typed SQLite handle so this package doesn't require
 * `better-sqlite3` at compile time.
 */

import { createRequire } from "node:module";
import { join } from "node:path";

interface SQLiteHandle {
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  exec(sql: string): void;
  close(): void;
}

export function openSqlite(dbPath: string): SQLiteHandle {
  const require = createRequire(join(process.cwd(), "package.json"));
  const BetterSqlite3 = require("better-sqlite3") as new (path: string, options?: { readonly?: boolean; fileMustExist?: boolean }) => SQLiteHandle;
  return new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true });
}

export interface SqliteMemoryItem {
  id: string;
  kind: string;
  session_id: string;
  tier: string | null;
  user_id: string | null;
  agent_id: string | null;
  timestamp: number;
  importance: number;
  role: string | null;
  content: string | null;
  key_name: string | null;
  value_text: string | null;
  metadata: string | null;
  from_timestamp: number | null;
  to_timestamp: number | null;
  replaced_entry_ids: string | null;
}

export function selectAll(handle: SQLiteHandle, sessionId?: string): SqliteMemoryItem[] {
  if (sessionId) {
    return handle
      .prepare("SELECT * FROM memory_items WHERE session_id = ? ORDER BY timestamp ASC")
      .all(sessionId) as SqliteMemoryItem[];
  }
  return handle
    .prepare("SELECT * FROM memory_items ORDER BY timestamp ASC")
    .all() as SqliteMemoryItem[];
}

export function selectById(handle: SQLiteHandle, id: string): SqliteMemoryItem | undefined {
  return handle
    .prepare("SELECT * FROM memory_items WHERE id = ?")
    .all(id)[0] as SqliteMemoryItem | undefined;
}

export function searchLike(handle: SQLiteHandle, query: string, sessionId?: string): SqliteMemoryItem[] {
  const like = `%${query.replace(/[%_]/g, "\\$&")}%`;
  if (sessionId) {
    return handle
      .prepare(
        "SELECT * FROM memory_items WHERE session_id = ? AND (content LIKE ? ESCAPE '\\' OR key_name LIKE ? ESCAPE '\\' OR value_text LIKE ? ESCAPE '\\') ORDER BY timestamp DESC LIMIT 50"
      )
      .all(sessionId, like, like, like) as SqliteMemoryItem[];
  }
  return handle
    .prepare(
      "SELECT * FROM memory_items WHERE content LIKE ? ESCAPE '\\' OR key_name LIKE ? ESCAPE '\\' OR value_text LIKE ? ESCAPE '\\' ORDER BY timestamp DESC LIMIT 50"
    )
    .all(like, like, like) as SqliteMemoryItem[];
}

export function stats(handle: SQLiteHandle, sessionId?: string): { total: number; byKind: Record<string, number>; byTier: Record<string, number>; sessions: number; users: number; agents: number } {
  const where = sessionId ? "WHERE session_id = ?" : "";
  const params = sessionId ? [sessionId] : [];
  const rows = handle
    .prepare(`SELECT kind, tier, user_id, agent_id, session_id FROM memory_items ${where}`)
    .all(...params) as Array<{ kind: string; tier: string | null; user_id: string | null; agent_id: string | null; session_id: string }>;

  const byKind: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const users = new Set<string>();
  const agents = new Set<string>();
  const sessions = new Set<string>();
  for (const r of rows) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    const tier = r.tier ?? "session";
    byTier[tier] = (byTier[tier] ?? 0) + 1;
    if (r.user_id) users.add(r.user_id);
    if (r.agent_id) agents.add(r.agent_id);
    sessions.add(r.session_id);
  }
  return { total: rows.length, byKind, byTier, sessions: sessions.size, users: users.size, agents: agents.size };
}

import { createRequire } from "node:module";
import { join } from "node:path";
import type {
  MemoryAdapter,
  MemoryItem,
  MemoryKind,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate
} from "@namitjain.india/agent-memory";

type StatementLike = {
  run: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => Record<string, unknown>[];
};

type SqliteDatabaseLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => StatementLike;
  loadExtension?: (path: string) => void;
  close?: () => void;
};

export interface SQLiteAdapterOptions {
  dbPath?: string;
  database?: SqliteDatabaseLike;
  vssExtensionPath?: string;
  loadVss?: boolean;
}

type MemoryRow = {
  id: string;
  kind: MemoryKind;
  session_id: string;
  timestamp: number;
  importance: number;
  role: string | null;
  content: string | null;
  key_name: string | null;
  value_text: string | null;
  embedding: string | null;
  metadata: string | null;
  from_timestamp: number | null;
  to_timestamp: number | null;
  replaced_entry_ids: string | null;
};

const requireModule = createRequire(join(process.cwd(), "package.json"));

export class SQLiteAdapter implements MemoryAdapter {
  private readonly db: SqliteDatabaseLike;

  constructor(options: SQLiteAdapterOptions = {}) {
    this.db = options.database ?? this.createDatabase(options.dbPath);
    this.setupSchema();

    if (options.loadVss && options.vssExtensionPath && this.db.loadExtension) {
      this.db.loadExtension(options.vssExtensionPath);
    }
  }

  async add(item: MemoryItem): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO memory_items (
        id, kind, session_id, timestamp, importance, role, content, key_name, value_text,
        embedding, metadata, from_timestamp, to_timestamp, replaced_entry_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const row = this.toRow(item);
    stmt.run(
      row.id,
      row.kind,
      row.session_id,
      row.timestamp,
      row.importance,
      row.role,
      row.content,
      row.key_name,
      row.value_text,
      row.embedding,
      row.metadata,
      row.from_timestamp,
      row.to_timestamp,
      row.replaced_entry_ids
    );
  }

  async search(
    queryVector: number[],
    options: MemorySearchOptions
  ): Promise<MemorySearchCandidate[]> {
    const limit = options.limit ?? 20;
    const rows = options.kinds?.length
      ? (this.db
          .prepare(
            `SELECT * FROM memory_items
             WHERE session_id = ? AND kind IN (${options.kinds.map(() => "?").join(",")})
             ORDER BY timestamp DESC
             LIMIT ?`
          )
          .all(options.sessionId, ...options.kinds, Math.max(limit * 6, limit)) as MemoryRow[])
      : (this.db
          .prepare(
            `SELECT * FROM memory_items
             WHERE session_id = ?
             ORDER BY timestamp DESC
             LIMIT ?`
          )
          .all(options.sessionId, Math.max(limit * 6, limit)) as MemoryRow[]);

    const scored = rows
      .map((row) => {
        const item = this.fromRow(row);
        let similarity = 0;
        if (item.embedding && item.embedding.length === queryVector.length) {
          similarity = normalizeSimilarity(cosineSimilarity(queryVector, item.embedding));
        }
        return { item, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM memory_items WHERE id = ?`).run(id);
  }

  async update(id: string, data: MemoryUpdate): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    const pushUpdate = (column: string, value: unknown): void => {
      updates.push(`${column} = ?`);
      values.push(value);
    };

    if (data.role !== undefined) pushUpdate("role", data.role);
    if (data.content !== undefined) pushUpdate("content", data.content);
    if (data.key !== undefined) pushUpdate("key_name", data.key);
    if (data.value !== undefined) pushUpdate("value_text", data.value);
    if (data.importance !== undefined) pushUpdate("importance", data.importance);
    if (data.embedding !== undefined)
      pushUpdate("embedding", JSON.stringify(data.embedding));
    if (data.metadata !== undefined) pushUpdate("metadata", JSON.stringify(data.metadata));
    if (data.timestamp !== undefined) pushUpdate("timestamp", data.timestamp);
    if (data.fromTimestamp !== undefined)
      pushUpdate("from_timestamp", data.fromTimestamp);
    if (data.toTimestamp !== undefined) pushUpdate("to_timestamp", data.toTimestamp);
    if (data.replacedEntryIds !== undefined)
      pushUpdate("replaced_entry_ids", JSON.stringify(data.replacedEntryIds));

    if (updates.length === 0) {
      return;
    }

    values.push(id);
    this.db
      .prepare(`UPDATE memory_items SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  async getBySession(sessionId: string): Promise<MemoryItem[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_items WHERE session_id = ? ORDER BY timestamp ASC`
      )
      .all(sessionId) as MemoryRow[];
    return rows.map((row) => this.fromRow(row));
  }

  /**
   * Delete all memory items for a given session.
   */
  async clear(sessionId: string): Promise<void> {
    this.db.prepare(`DELETE FROM memory_items WHERE session_id = ?`).run(sessionId);
  }

  close(): void {
    this.db.close?.();
  }

  private createDatabase(dbPath: string = ":memory:"): SqliteDatabaseLike {
    const BetterSqlite3 = requireModule("better-sqlite3") as new (
      path: string
    ) => SqliteDatabaseLike;
    return new BetterSqlite3(dbPath);
  }

  private setupSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        importance REAL NOT NULL DEFAULT 0.5,
        role TEXT,
        content TEXT,
        key_name TEXT,
        value_text TEXT,
        embedding TEXT,
        metadata TEXT,
        from_timestamp INTEGER,
        to_timestamp INTEGER,
        replaced_entry_ids TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memory_items_session ON memory_items(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_memory_items_kind ON memory_items(kind);
      CREATE INDEX IF NOT EXISTS idx_memory_items_embedding ON memory_items(session_id) WHERE embedding IS NOT NULL;
    `);
  }

  private toRow(item: MemoryItem): Omit<MemoryRow, "kind"> & { kind: string } {
    return {
      id: item.id,
      kind: item.kind,
      session_id: item.sessionId,
      timestamp: item.timestamp,
      importance: item.importance,
      role: item.kind === "entry" ? item.role : null,
      content: "content" in item ? item.content : null,
      key_name: item.kind === "fact" ? item.key : null,
      value_text: item.kind === "fact" ? item.value : null,
      embedding: item.embedding ? JSON.stringify(item.embedding) : null,
      metadata: item.metadata ? JSON.stringify(item.metadata) : null,
      from_timestamp: item.kind === "summary" ? item.fromTimestamp : null,
      to_timestamp: item.kind === "summary" ? item.toTimestamp : null,
      replaced_entry_ids:
        item.kind === "summary" ? JSON.stringify(item.replacedEntryIds) : null
    };
  }

  private fromRow(row: MemoryRow): MemoryItem {
    const embedding = row.embedding
      ? (JSON.parse(row.embedding) as number[])
      : undefined;
    const metadata = row.metadata
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : undefined;
    const optionalFields = {
      ...(embedding ? { embedding } : {}),
      ...(metadata ? { metadata } : {})
    };

    const base = {
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      importance: row.importance
    };

    if (row.kind === "entry") {
      return {
        ...base,
        ...optionalFields,
        kind: "entry",
        role: (row.role ?? "user") as "system" | "user" | "assistant" | "tool",
        content: row.content ?? ""
      };
    }

    if (row.kind === "fact") {
      return {
        ...base,
        ...optionalFields,
        kind: "fact",
        key: row.key_name ?? "",
        value: row.value_text ?? "",
        content: row.content ?? `${row.key_name ?? ""}: ${row.value_text ?? ""}`
      };
    }

    return {
      ...base,
      ...optionalFields,
      kind: "summary",
      content: row.content ?? "",
      fromTimestamp: row.from_timestamp ?? row.timestamp,
      toTimestamp: row.to_timestamp ?? row.timestamp,
      replacedEntryIds: row.replaced_entry_ids
        ? (JSON.parse(row.replaced_entry_ids) as string[])
        : []
    };
  }
}

// ─── Local Math Helpers ────────────────────────────────────────────────────────
// Kept local to avoid bundler issues with the core package's Node-compatible math.

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeSimilarity(similarity: number): number {
  return Math.min(Math.max((similarity + 1) / 2, 0), 1);
}

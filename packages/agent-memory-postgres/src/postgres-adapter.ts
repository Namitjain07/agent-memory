import type {
  MemoryAdapter,
  MemoryItem,
  MemoryKind,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate
} from "@namitjain.india/agent-memory";

type QueryResultRow = Record<string, unknown>;

type PgClientLike = {
  query: (query: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[] }>;
  end?: () => Promise<void>;
};

type PgPoolLike = PgClientLike;

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
  embedding: unknown;
  metadata: Record<string, unknown> | null;
  from_timestamp: number | null;
  to_timestamp: number | null;
  replaced_entry_ids: string[] | null;
  similarity?: number;
};

export interface PostgresAdapterOptions {
  client?: PgClientLike;
  connectionString?: string;
  tableName?: string;
  autoCreateExtension?: boolean;
}

export class PostgresAdapter implements MemoryAdapter {
  private client: PgClientLike | null;

  private pool: PgPoolLike | null = null;

  private readonly connectionString: string | undefined;

  private readonly tableName: string;

  private readonly autoCreateExtension: boolean;

  private initPromise: Promise<void> | null = null;

  constructor(options: PostgresAdapterOptions = {}) {
    this.client = options.client ?? null;
    this.connectionString = options.connectionString;
    this.tableName = options.tableName ?? "memory_items";
    this.autoCreateExtension = options.autoCreateExtension ?? true;
  }

  async add(item: MemoryItem): Promise<void> {
    await this.ensureInitialized();
    const client = this.client!;
    await client.query(
      `INSERT INTO ${this.tableName} (
        id, kind, session_id, timestamp, importance, role, content, key_name, value_text,
        embedding, metadata, from_timestamp, to_timestamp, replaced_entry_ids
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10::vector, $11::jsonb, $12, $13, $14::text[]
      )`,
      [
        item.id,
        item.kind,
        item.sessionId,
        item.timestamp,
        item.importance,
        item.kind === "entry" ? item.role : null,
        "content" in item ? item.content : null,
        item.kind === "fact" ? item.key : null,
        item.kind === "fact" ? item.value : null,
        item.embedding ? toVectorLiteral(item.embedding) : null,
        item.metadata ? JSON.stringify(item.metadata) : null,
        item.kind === "summary" ? item.fromTimestamp : null,
        item.kind === "summary" ? item.toTimestamp : null,
        item.kind === "summary" ? item.replacedEntryIds : null
      ]
    );
  }

  async search(
    queryVector: number[],
    options: MemorySearchOptions
  ): Promise<MemorySearchCandidate[]> {
    await this.ensureInitialized();
    const client = this.client!;
    const limit = options.limit ?? 20;
    const result = await client.query(
      `SELECT *,
        CASE
          WHEN embedding IS NULL THEN 0
          ELSE 1 - (embedding <=> $1::vector)
        END AS similarity
      FROM ${this.tableName}
      WHERE session_id = $2
        AND ($3::text[] IS NULL OR kind = ANY($3))
      ORDER BY similarity DESC, timestamp DESC
      LIMIT $4`,
      [toVectorLiteral(queryVector), options.sessionId, options.kinds ?? null, limit]
    );

    return result.rows.map((row) => {
      const memoryRow = row as unknown as MemoryRow;
      return {
        item: this.fromRow(memoryRow),
        similarity: clamp(memoryRow.similarity ?? 0, 0, 1)
      };
    });
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.client!.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
  }

  async update(id: string, data: MemoryUpdate): Promise<void> {
    await this.ensureInitialized();
    const updates: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const push = (column: string, value: unknown, cast?: string): void => {
      updates.push(
        `${column} = $${index}${cast ? `::${cast}` : ""}`
      );
      values.push(value);
      index += 1;
    };

    if (data.role !== undefined) push("role", data.role);
    if (data.content !== undefined) push("content", data.content);
    if (data.key !== undefined) push("key_name", data.key);
    if (data.value !== undefined) push("value_text", data.value);
    if (data.importance !== undefined) push("importance", data.importance);
    if (data.embedding !== undefined)
      push("embedding", data.embedding ? toVectorLiteral(data.embedding) : null, "vector");
    if (data.metadata !== undefined)
      push("metadata", data.metadata ? JSON.stringify(data.metadata) : null, "jsonb");
    if (data.timestamp !== undefined) push("timestamp", data.timestamp);
    if (data.fromTimestamp !== undefined) push("from_timestamp", data.fromTimestamp);
    if (data.toTimestamp !== undefined) push("to_timestamp", data.toTimestamp);
    if (data.replacedEntryIds !== undefined)
      push("replaced_entry_ids", data.replacedEntryIds, "text[]");

    if (updates.length === 0) {
      return;
    }

    values.push(id);
    await this.client!.query(
      `UPDATE ${this.tableName} SET ${updates.join(", ")} WHERE id = $${index}`,
      values
    );
  }

  async getBySession(sessionId: string): Promise<MemoryItem[]> {
    await this.ensureInitialized();
    const result = await this.client!.query(
      `SELECT * FROM ${this.tableName} WHERE session_id = $1 ORDER BY timestamp ASC`,
      [sessionId]
    );
    return result.rows.map((row) => this.fromRow(row as unknown as MemoryRow));
  }

  async close(): Promise<void> {
    if (this.pool?.end) {
      await this.pool.end();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    if (!this.client) {
      const pgModule = (await loadOptionalModule("pg")) as {
        Pool: new (config?: { connectionString?: string }) => PgPoolLike;
      };
      const config = this.connectionString
        ? { connectionString: this.connectionString }
        : undefined;
      this.pool = new pgModule.Pool(config);
      this.client = this.pool;
    }

    if (this.autoCreateExtension) {
      await this.client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    }

    await this.client.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        session_id TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        importance REAL NOT NULL DEFAULT 0.5,
        role TEXT,
        content TEXT,
        key_name TEXT,
        value_text TEXT,
        embedding vector,
        metadata JSONB,
        from_timestamp BIGINT,
        to_timestamp BIGINT,
        replaced_entry_ids TEXT[]
      );
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_session
      ON ${this.tableName}(session_id, timestamp);
    `);
  }

  private fromRow(row: MemoryRow): MemoryItem {
    const embedding = parseEmbedding(row.embedding);
    const metadata = row.metadata ?? undefined;
    const optionalFields = {
      ...(embedding ? { embedding } : {}),
      ...(metadata ? { metadata } : {})
    };

    const base = {
      id: row.id,
      sessionId: row.session_id,
      timestamp: Number(row.timestamp),
      importance: Number(row.importance)
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
      fromTimestamp: Number(row.from_timestamp ?? row.timestamp),
      toTimestamp: Number(row.to_timestamp ?? row.timestamp),
      replacedEntryIds: row.replaced_entry_ids ?? []
    };
  }
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function parseEmbedding(raw: unknown): number[] | undefined {
  if (!raw) {
    return undefined;
  }

  if (Array.isArray(raw)) {
    return raw.map((value) => Number(value));
  }

  const text = String(raw).trim();
  const stripped = text.replace(/^\[|\]$/g, "");
  if (!stripped) {
    return [];
  }
  return stripped.split(",").map((value) => Number(value.trim()));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadOptionalModule(moduleName: string): Promise<unknown> {
  const dynamicImport = new Function(
    "moduleName",
    "return import(moduleName);"
  ) as (moduleName: string) => Promise<unknown>;
  return dynamicImport(moduleName);
}

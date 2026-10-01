import type {
  MemoryAdapter,
  MemoryItem,
  MemoryKind,
  MemorySearchCandidate,
  MemorySearchOptions,
  MemoryUpdate,
  MemoryTier
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
  tier: string | null;
  user_id: string | null;
  agent_id: string | null;
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
  /**
   * Pass an existing Pool to use it (alternative to `client`).
   * Both `client` and `pool` are accepted — the first non-null one wins.
   */
  pool?: PgPoolLike;
  /** Connection pool settings (only used if a connection string is given). */
  poolConfig?: { max?: number; idleTimeoutMillis?: number; connectionTimeoutMillis?: number };
}

export class PostgresAdapter implements MemoryAdapter {
  private client: PgClientLike | null;

  private pool: PgPoolLike | null = null;

  private readonly connectionString: string | undefined;

  private readonly tableName: string;

  private readonly autoCreateExtension: boolean;

  private readonly poolConfig: PostgresAdapterOptions["poolConfig"];

  /**
   * initPromise is set synchronously before the first await to prevent
   * concurrent initialize() calls racing each other.
   */
  private initPromise: Promise<void> | null = null;

  constructor(options: PostgresAdapterOptions = {}) {
    this.client = options.client ?? options.pool ?? null;
    this.connectionString = options.connectionString;
    this.tableName = options.tableName ?? "memory_items";
    this.autoCreateExtension = options.autoCreateExtension ?? true;
    this.poolConfig = options.poolConfig;
  }

  async add(item: MemoryItem): Promise<void> {
    await this.ensureInitialized();
    const client = this.client!;
    await client.query(
      `INSERT INTO ${this.tableName} (
        id, kind, session_id, tier, user_id, agent_id, timestamp, importance,
        role, content, key_name, value_text, embedding, metadata,
        from_timestamp, to_timestamp, replaced_entry_ids
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11::jsonb, $12, $13, $14, $15, $16, $17::text[]
      )`,
      [
        item.id,
        item.kind,
        item.sessionId,
        item.tier ?? null,
        item.userId ?? null,
        item.agentId ?? null,
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

  async search(queryVector: number[], options: MemorySearchOptions): Promise<MemorySearchCandidate[]> {
    await this.ensureInitialized();
    const client = this.client!;
    const limit = options.limit ?? 20;

    const conditions: string[] = ["session_id = $1"];
    const params: unknown[] = [options.sessionId];
    let nextParam = 2;

    if (options.kinds && options.kinds.length > 0) {
      conditions.push(`kind = ANY($${nextParam}::text[])`);
      params.push(options.kinds);
      nextParam += 1;
    }
    if (options.tiers && options.tiers.length > 0) {
      // Items with NULL tier are treated as "session" tier for backward compatibility
      conditions.push(
        `(tier = ANY($${nextParam}::text[]) OR (tier IS NULL AND 'session' = ANY($${nextParam}::text[])))`
      );
      params.push(options.tiers);
      nextParam += 1;
    }
    if (options.userId) {
      conditions.push(`user_id = $${nextParam}`);
      params.push(options.userId);
      nextParam += 1;
    }
    if (options.agentId) {
      conditions.push(`agent_id = $${nextParam}`);
      params.push(options.agentId);
      nextParam += 1;
    }

    const whereClause = conditions.join(" AND ");
    const hasVector = queryVector.length > 0;

    if (hasVector) {
      // Vector path: native pgvector cosine distance, with similarity in [0, 1].
      const vectorParam = nextParam;
      const limitParam = nextParam + 1;
      const sql = `
        SELECT *,
          CASE
            WHEN embedding IS NULL THEN 0
            ELSE 1 - (embedding <=> $${vectorParam}::vector)
          END AS similarity
        FROM ${this.tableName}
        WHERE ${whereClause}
        ORDER BY (embedding IS NOT NULL) DESC, embedding <=> $${vectorParam}::vector ASC, timestamp DESC
        LIMIT $${limitParam}
      `;
      const result = await client.query(sql, [...params, toVectorLiteral(queryVector), limit]);
      return result.rows.map((row) => {
        const memoryRow = row as unknown as MemoryRow;
        return {
          item: this.fromRow(memoryRow),
          similarity: clamp(memoryRow.similarity ?? 0, 0, 1)
        };
      });
    }

    // No-vector fallback: order by timestamp, similarity = 0.
    const limitParam = nextParam;
    const result = await client.query(
      `SELECT *, 0 AS similarity FROM ${this.tableName} WHERE ${whereClause} ORDER BY timestamp DESC LIMIT $${limitParam}`,
      [...params, limit]
    );
    return result.rows.map((row) => {
      const memoryRow = row as unknown as MemoryRow;
      return { item: this.fromRow(memoryRow), similarity: 0 };
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
      updates.push(`${column} = $${index}${cast ? `::${cast}` : ""}`);
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
    if (data.replacedEntryIds !== undefined) push("replaced_entry_ids", data.replacedEntryIds, "text[]");
    if (data.tier !== undefined) push("tier", data.tier);
    if (data.userId !== undefined) push("user_id", data.userId);
    if (data.agentId !== undefined) push("agent_id", data.agentId);

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

  /**
   * Delete all memory items for a given session.
   */
  async clear(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    await this.client!.query(`DELETE FROM ${this.tableName} WHERE session_id = $1`, [sessionId]);
  }

  async close(): Promise<void> {
    if (this.pool?.end) {
      await this.pool.end();
    }
  }

  private ensureInitialized(): Promise<void> {
    // Set initPromise synchronously before any await to prevent concurrent races
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    if (!this.client) {
      const pgModule = (await loadOptionalModule("pg")) as {
        Pool: new (config?: Record<string, unknown>) => PgPoolLike;
      };
      const config: Record<string, unknown> = this.connectionString
        ? { connectionString: this.connectionString, ...(this.poolConfig ?? {}) }
        : { ...(this.poolConfig ?? {}) };
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
        tier TEXT,
        user_id TEXT,
        agent_id TEXT,
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
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_tier
      ON ${this.tableName}(tier);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user
      ON ${this.tableName}(user_id);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_agent
      ON ${this.tableName}(agent_id);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_embedding_hnsw
      ON ${this.tableName} USING hnsw (embedding vector_cosine_ops)
      WHERE embedding IS NOT NULL;
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

    const tierFields: { tier?: MemoryTier; userId?: string; agentId?: string } = {};
    if (row.tier) tierFields.tier = row.tier as MemoryTier;
    if (row.user_id) tierFields.userId = row.user_id;
    if (row.agent_id) tierFields.agentId = row.agent_id;

    if (row.kind === "entry") {
      return {
        ...base,
        ...optionalFields,
        ...tierFields,
        kind: "entry",
        role: (row.role ?? "user") as "system" | "user" | "assistant" | "tool",
        content: row.content ?? ""
      };
    }

    if (row.kind === "fact") {
      return {
        ...base,
        ...optionalFields,
        ...tierFields,
        kind: "fact",
        key: row.key_name ?? "",
        value: row.value_text ?? "",
        content: row.content ?? `${row.key_name ?? ""}: ${row.value_text ?? ""}`
      };
    }

    return {
      ...base,
      ...optionalFields,
      ...tierFields,
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
  const dynamicImport = new Function("moduleName", "return import(moduleName);") as (
    moduleName: string
  ) => Promise<unknown>;
  return dynamicImport(moduleName);
}

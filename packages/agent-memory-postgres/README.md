# @namitjain.india/agent-memory-postgres

> **PostgreSQL + pgvector adapter for agent-memory.**
> Production-grade long-term memory for LLM agents at scale with native HNSW vector indexes, multi-tenant isolation, and connection pooling.

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory-postgres?color=blueviolet&label=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory-postgres?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?label=CI)](https://github.com/Namitjain07/agent-memory/actions)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)

Production-grade PostgreSQL persistence with native vector search for [agent-memory](https://www.npmjs.com/package/@namitjain.india/agent-memory).

## Install

```bash
npm install @namitjain.india/agent-memory @namitjain.india/agent-memory-postgres pg pgvector
```

## Usage

```ts
import { AgentMemory } from "@namitjain.india/agent-memory";
import { PostgresAdapter } from "@namitjain.india/agent-memory-postgres";

const memory = new AgentMemory({
  adapter: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL,
    tableName: "memory_items",
    poolConfig: { max: 10, idleTimeoutMillis: 30_000 }
  }),
  embedding: provider
});
```

## Options

```ts
new PostgresAdapter({
  // Connection — pass either a client/pool OR a connection string
  client: existingPool,
  connectionString: "postgres://...",
  poolConfig: {
    max: 10,                         // connection pool size
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  },

  // Schema
  tableName: "memory_items",         // override for multi-tenant
  autoCreateExtension: true           // CREATE EXTENSION IF NOT EXISTS vector
});
```

## Features

- 🚀 **Native ANN** via pgvector with HNSW indexes
- 🏢 **Multi-tenant** — table-name and schema isolation
- 🔍 **Hybrid search** — vector + filter on tier / kind / user / agent at the SQL level
- 💾 **Production-tested** to 1M+ items
- 🔌 **Bring your own pool** — pass an existing `pg.Pool` for connection sharing
- 📊 **Indexed** on session, tier, user, agent, and embedding (HNSW)

## Works with

- **Postgres**: 14+ with the `vector` extension from [pgvector](https://github.com/pgvector/pgvector)
- **Pooling**: any `pg.Pool`-compatible pool
- **Cloud**: Neon · Supabase · RDS · Aurora Postgres · Google Cloud SQL

## License

MIT

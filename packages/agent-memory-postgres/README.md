# @namitjain.india/agent-memory-postgres

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory-postgres)](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

Postgres adapter for [@namitjain.india/agent-memory](https://www.npmjs.com/package/@namitjain.india/agent-memory). Provides production-scale persistence with pgvector support for semantic search.

[GitHub](https://github.com/Namitjain07/agent-memory) | [Report Bug](https://github.com/Namitjain07/agent-memory/issues) | [Request Feature](https://github.com/Namitjain07/agent-memory/issues)

## Installation

```bash
npm install @namitjain.india/agent-memory-postgres pg pgvector
```

## Usage

```typescript
import { AgentMemory } from "@namitjain.india/agent-memory";
import { PostgresAdapter } from "@namitjain.india/agent-memory-postgres";

const memory = new AgentMemory({
  adapter: new PostgresAdapter({
    connectionString: "postgresql://user:pass@localhost:5432/memory"
  }),
  embedding: {
    embedFn: async (text) => [text.length / 100, 0.5]
  }
});
```

## PostgresAdapter Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectionString` | `string` | - | PostgreSQL connection string |
| `client` | `PgClientLike` | - | Custom pg client/pool instance |
| `tableName` | `string` | `memory_items` | Custom table name |
| `autoCreateExtension` | `boolean` | `true` | Auto-create vector extension |

## Features

- **Production Scale**: Designed for high-traffic production environments
- **pgvector Support**: Native vector similarity search using `<=>` operator
- **Connection Pooling**: Uses pg Pool for efficient connections
- **Type Support**: Full support for entries, facts, and summaries
- **Schema Auto-Creation**: Tables and indexes created automatically
- **Async Initialization**: Lazy initialization with promise caching

## Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_items (
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

CREATE INDEX idx_memory_items_session ON memory_items(session_id, timestamp);
```

## Example with Custom Table

```typescript
const memory = new AgentMemory({
  adapter: new PostgresAdapter({
    connectionString: "postgresql://...",
    tableName: "user_memory", // Custom table name
    autoCreateExtension: true
  }),
  embedding: {
    embedFn: async (text) => [/* embeddings */]
  }
});
```

## Example with Custom Client

```typescript
import { Pool } from "pg";

const pool = new Pool({ connectionString: "postgresql://..." });

const memory = new AgentMemory({
  adapter: new PostgresAdapter({
    client: pool // Reuse existing connection pool
  }),
  embedding: {
    embedFn: async (text) => [/* embeddings */]
  }
});
```

## Methods

### `close()`

Close the connection pool.

```typescript
const adapter = new PostgresAdapter({ connectionString: "postgresql://..." });
// ... use adapter ...
await adapter.close();
```

## Requirements

- Node.js >= 18.0.0
- PostgreSQL >= 14.0 (for vector support)
- `pg` >= 8.0.0
- `pgvector` >= 0.2.0

## Contributing & Collaboration

We welcome contributions, feedback, and feature requests!

- **Bug Reports**: [Open an issue](https://github.com/Namitjain07/agent-memory/issues)
- **Feature Requests**: [Share it](https://github.com/Namitjain07/agent-memory/issues)
- **Pull Requests**: [Submit a PR](https://github.com/Namitjain07/agent-memory/pulls)

If this project helps you, please consider [starring it on GitHub](https://github.com/Namitjain07/agent-memory)!

## License

MIT
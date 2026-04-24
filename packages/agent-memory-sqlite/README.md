# @namitjain.india/agent-memory-sqlite

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory-sqlite)](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

SQLite adapter for [@namitjain.india/agent-memory](https://www.npmjs.com/package/@namitjain.india/agent-memory). Provides persistent storage using better-sqlite3 with full-text search capabilities.

[GitHub](https://github.com/Namitjain07/agent-memory) | [Report Bug](https://github.com/Namitjain07/agent-memory/issues) | [Request Feature](https://github.com/Namitjain07/agent-memory/issues)

## Installation

```bash
npm install @namitjain.india/agent-memory-sqlite better-sqlite3 sqlite-vss
```

## Usage

```typescript
import { AgentMemory } from "@namitjain.india/agent-memory";
import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";

const memory = new AgentMemory({
  adapter: new SQLiteAdapter({
    dbPath: "./memory.db"
  }),
  embedding: {
    embedFn: async (text) => [text.length / 100, 0.5]
  }
});
```

## SQLiteAdapter Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dbPath` | `string` | `:memory:` | Path to SQLite database file |
| `database` | `SqliteDatabaseLike` | - | Custom database instance |
| `vssExtensionPath` | `string` | - | Path to sqlite-vss extension |
| `loadVss` | `boolean` | `false` | Load VSS extension for vector search |

## Features

- **Persistent Storage**: Data survives process restarts
- **Session-Based**: Automatic session indexing
- **Type Support**: Full support for entries, facts, and summaries
- **VSS Support**: Optional vector similarity search via sqlite-vss
- **Schema Auto-Creation**: Tables and indexes created automatically

## Database Schema

```sql
CREATE TABLE memory_items (
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

CREATE INDEX idx_memory_items_session ON memory_items(session_id, timestamp);
CREATE INDEX idx_memory_items_kind ON memory_items(kind);
```

## Example with VSS

```typescript
import { AgentMemory } from "@namitjain.india/agent-memory";
import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";

// Load sqlite-vss extension for vector similarity search
const memory = new AgentMemory({
  adapter: new SQLiteAdapter({
    dbPath: "./memory.db",
    vssExtensionPath: "/path/to/sqlite-vss.so",
    loadVss: true
  }),
  embedding: {
    embedFn: async (text) => [/* embeddings */]
  }
});
```

## Methods

### `close()`

Close the database connection.

```typescript
const adapter = new SQLiteAdapter({ dbPath: "./memory.db" });
// ... use adapter ...
adapter.close();
```

## Requirements

- Node.js >= 18.0.0
- `better-sqlite3` >= 11.0.0
- `sqlite-vss` >= 0.1.2 (optional, for vector search)

## Contributing & Collaboration

We welcome contributions, feedback, and feature requests!

- **Bug Reports**: [Open an issue](https://github.com/Namitjain07/agent-memory/issues)
- **Feature Requests**: [Share it](https://github.com/Namitjain07/agent-memory/issues)
- **Pull Requests**: [Submit a PR](https://github.com/Namitjain07/agent-memory/pulls)

If this project helps you, please consider [starring it on GitHub](https://github.com/Namitjain07/agent-memory)!

## License

MIT
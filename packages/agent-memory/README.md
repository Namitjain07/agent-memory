# @namitjain.india/agent-memory

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

Production-grade memory infrastructure for AI agents, built with TypeScript and designed for real-world scale.

> **Note**: This is part of the agent-memory monorepo. For general usage, this is the package you need. See also: [SQLite adapter](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite) | [Postgres adapter](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) | [React hooks](https://www.npmjs.com/package/@namitjain.india/agent-memory-react)

[GitHub](https://github.com/Namitjain07/agent-memory) | [Report Bug](https://github.com/Namitjain07/agent-memory/issues) | [Request Feature](https://github.com/Namitjain07/agent-memory/issues)

## Installation

```bash
npm install @namitjain.india/agent-memory
```

## Features

- **3-Layer Memory Model**
  - **Episodic**: immutable raw turns (ground truth)
  - **Semantic**: extracted facts (key/value + embeddings)
  - **Summary**: compressed long-term context

- **Hybrid Retrieval Scoring**
  ```
  score = w1*similarity + w2*recency + w3*importance
  ```
  Defaults: `0.6`, `0.3`, `0.1`

- **Provider-Agnostic Embeddings**
  - Bring your own `embedFn` / `embedBatchFn`

- **Summarization Controls**
  - Trigger by token budget and/or turn count

- **Adapter Abstraction**
  - Built-in in-memory adapter
  - Optional SQLite and Postgres adapters for persistence

- **TypeScript-First + Dual Output**
  - ESM + CJS builds

## Quick Start

### Middleware API (Simplest)

```typescript
import { withMemory } from "@namitjain.india/agent-memory";

const embedFn = async (text: string) => [text.length / 1000, Number(text.includes("typescript"))];

const runAgent = withMemory(
  async (messages) => {
    // Call your LLM provider
    return "Assistant response";
  },
  {
    embedding: { embedFn },
    sessionId: "default-session"
  }
);

const output = await runAgent([
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "I prefer TypeScript." }
]);
```

### Class API (Full Control)

```typescript
import { AgentMemory } from "@namitjain.india/agent-memory";

const memory = new AgentMemory({
  embedding: {
    embedFn: async (text) => [text.length / 500]
  },
  retrieval: {
    topK: 6,
    recencyLambda: 0.04,
    weights: {
      similarity: 0.6,
      recency: 0.3,
      importance: 0.1
    }
  },
  summarisation: {
    maxTurns: 30,
    tokenBudget: 4000,
    keepRecentTurns: 10
  }
});

// Store a conversation entry
await memory.remember({
  kind: "entry",
  role: "user",
  content: "I prefer TypeScript over JavaScript",
  sessionId: "session-1",
  importance: 0.8
});

// Store a fact
await memory.remember({
  kind: "fact",
  sessionId: "session-1",
  key: "preferred_language",
  value: "TypeScript",
  importance: 1
});

// Recall memories
const recalled = await memory.recall("What language does the user prefer?", {
  sessionId: "session-1",
  topK: 3
});
```

### Context Injection

Memory is automatically injected as a named system block:

```typescript
[
  { role: "system", content: "You are a helpful assistant." },
  { role: "system", name: "memory", content: "...retrieved memories..." },
  { role: "user", content: "What do I prefer?" }
]
```

## API Reference

### AgentMemory

```typescript
const memory = new AgentMemory(options?: AgentMemoryOptions)
```

#### Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `adapter` | `MemoryAdapter` | `InMemoryAdapter` | Storage adapter |
| `embedding.embedFn` | `(text: string) => Promise<number[]>` | - | Single text embedding function |
| `embedding.embedBatchFn` | `(texts: string[]) => Promise<number[][]>` | - | Batch embedding function |
| `retrieval.topK` | `number` | `5` | Number of memories to retrieve |
| `retrieval.candidateMultiplier` | `number` | `4` | Retrieval candidate pool multiplier |
| `retrieval.recencyLambda` | `number` | `0.03` | Recency decay factor |
| `retrieval.weights.similarity` | `number` | `0.6` | Similarity weight |
| `retrieval.weights.recency` | `number` | `0.3` | Recency weight |
| `retrieval.weights.importance` | `number` | `0.1` | Importance weight |
| `summarisation.maxTurns` | `number` | `24` | Max turns before summarisation |
| `summarisation.tokenBudget` | `number` | `3000` | Token budget before summarisation |
| `summarisation.keepRecentTurns` | `number` | `8` | Recent turns to preserve |
| `summarisation.summariseFn` | `SummariseFn` | - | Custom summarisation function |
| `defaultSessionId` | `string` | `"default"` | Default session ID |

#### Methods

##### `remember(input)`

Store a memory entry or fact.

```typescript
// Entry (conversation turn)
await memory.remember({
  kind: "entry",
  role: "user" | "assistant" | "system" | "tool",
  content: "message content",
  sessionId?: "session-1",
  importance?: 0.5, // 0-1 scale
  metadata?: { /* custom data */ }
});

// Fact (key-value pair)
await memory.remember({
  kind: "fact",
  key: "user_preference",
  value: "TypeScript",
  sessionId?: "session-1",
  importance?: 0.8
});
```

##### `recall(query, options?)`

Retrieve relevant memories using hybrid scoring.

```typescript
const results = await memory.recall("What does the user prefer?", {
  sessionId?: "session-1",
  topK?: 5,
  kinds?: ["entry", "fact", "summary"], // filter by kind
  minScore?: 0.3 // minimum score threshold
});

// Results include score breakdown:
results.forEach(r => {
  console.log(r.item.content);
  console.log(`Score: ${r.score} (sim: ${r.similarity}, rec: ${r.recency}, imp: ${r.importance})`);
});
```

##### `inject(messages, options?)`

Inject retrieved memories into a message array.

```typescript
const enhancedMessages = await memory.inject(
  [{ role: "user", content: "Hello" }],
  {
    sessionId?: "session-1",
    topK?: 3,
    query?: "custom query", // defaults to last user message
    role?: "system", // memory message role
    name?: "memory", // memory message name
    format?: (results) => "..." // custom format
  }
);
```

##### `summarise(options?)`

Summarize older entries to save context.

```typescript
await memory.summarise({
  sessionId?: "session-1",
  force?: false,
  maxTurns?: 24,
  tokenBudget?: 3000,
  keepRecentTurns?: 8
});
```

##### `forget(id)`

Delete a specific memory by ID.

```typescript
await memory.forget("memory-entry-id");
```

##### `getBySession(sessionId?)`

Get all memories for a session.

```typescript
const allMemories = await memory.getBySession("session-1");
```

### withMemory

Middleware wrapper for easy integration.

```typescript
const runAgent = withMemory(agentFn, options);
const output = await runAgent(messages, runOptions?, ...extra);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessionId` | `string` | `"default"` | Session ID |
| `topK` | `number` | - | Memories to retrieve |
| `autoStoreInput` | `boolean` | `true` | Auto-store user messages |
| `autoStoreOutput` | `boolean` | `true` | Auto-store assistant responses |
| `autoSummarise` | `boolean` | `true` | Auto-summarise when needed |

### Memory Types

```typescript
// Entry (conversation turn)
interface MemoryEntry {
  id: string;
  kind: "entry";
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  importance: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

// Fact (key-value)
interface MemoryFact {
  id: string;
  kind: "fact";
  sessionId: string;
  key: string;
  value: string;
  content: string;
  timestamp: number;
  importance: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

// Summary
interface MemorySummary {
  id: string;
  kind: "summary";
  sessionId: string;
  content: string;
  timestamp: number;
  importance: number;
  fromTimestamp: number;
  toTimestamp: number;
  replacedEntryIds: string[];
}
```

## Storage Adapters

### In-Memory (Built-in)

Default adapter, data is lost on process restart.

```typescript
import { AgentMemory, InMemoryAdapter } from "@namitjain.india/agent-memory";

const memory = new AgentMemory({
  adapter: new InMemoryAdapter()
});
```

### SQLite (Persistence)

For serverless and local development.

```typescript
import { AgentMemory } from "@namitjain.india/agent-memory";
import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";

const memory = new AgentMemory({
  adapter: new SQLiteAdapter({ dbPath: "./memory.db" }),
  embedding: { embedFn }
});
```

See [@namitjain.india/agent-memory-sqlite](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite) for full documentation.

### Postgres (Production Scale)

For production with pgvector support.

```typescript
import { AgentMemory } from "@namitjain.india/agent-memory";
import { PostgresAdapter } from "@namitjain.india/agent-memory-postgres";

const memory = new AgentMemory({
  adapter: new PostgresAdapter({
    connectionString: "postgresql://..."
  }),
  embedding: { embedFn }
});
```

See [@namitjain.india/agent-memory-postgres](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) for full documentation.

## Contributing & Collaboration

We welcome contributions, feedback, and feature requests!

### Ways to Contribute

- **Bug Reports**: Found a bug? [Open an issue](https://github.com/Namitjain07/agent-memory/issues)
- **Feature Requests**: Have an idea? [Share it](https://github.com/Namitjain07/agent-memory/issues)
- **Pull Requests**: Want to contribute code? [Submit a PR](https://github.com/Namitjain07/agent-memory/pulls)
- **Documentation**: Help improve the docs

### Development

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory
npm install
npm test
npm run build
```

### Roadmap

We plan to add:
- MongoDB adapter
- Redis adapter with vector search
- More embedding provider integrations (OpenAI, Anthropic, Cohere)
- Conversation chain persistence
- Multi-agent memory sharing

### Star the Project

If this project helps you, please consider [starring it on GitHub](https://github.com/Namitjain07/agent-memory)!

Your support helps the project grow and reach more developers.

## License

MIT - see [LICENSE](https://github.com/Namitjain07/agent-memory/blob/main/LICENSE)
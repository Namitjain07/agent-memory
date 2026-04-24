# @namitjain.india/agent-memory

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory?color=blueviolet)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)

Production-grade memory infrastructure for AI agents, built with TypeScript.

> Part of the agent-memory monorepo.
> See also: [SQLite adapter](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite) | [Postgres adapter](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) | [React hooks](https://www.npmjs.com/package/@namitjain.india/agent-memory-react)

[GitHub](https://github.com/Namitjain07/agent-memory) · [Report Bug](https://github.com/Namitjain07/agent-memory/issues)

---

## Installation

```bash
npm install @namitjain.india/agent-memory
```

---

## How It Works

```
remember(entry/fact)
      │
      ▼
  embed content ──► store in adapter (InMemory / SQLite / Postgres)
      
recall(query)
      │
      ├── embed query
      ├── vector search in adapter  ──► candidates
      └── hybrid score each candidate:
            score = 0.6 × similarity
                  + 0.3 × recency          (exponential decay)
                  + 0.1 × importance
          ──► top-K results

inject(messages)
      │
      └── recall(last user message)
          ──► insert { role:"system", name:"memory" } block
              before first non-system message
```

---

## Features

- **3-Layer Memory Model**
  - **Episodic** (`entry`) — raw conversation turns, auto-embedded
  - **Semantic** (`fact`) — key-value facts with embeddings
  - **Summary** (`summary`) — compressed long-term context
- **Hybrid Retrieval** — `score = 0.6·sim + 0.3·recency + 0.1·importance`
- **Graceful Degradation** — `recall()` works without embeddings (recency+importance only)
- **Provider-Agnostic** — bring your own `embedFn` (OpenAI, NVIDIA, Cohere, etc.)
- **Built-in Helpers** — `createOpenAIEmbedFn`, `createOpenAIBatchEmbedFn`, `createBatchEmbedFn`
- **Filter Callbacks** — `filter: (item) => boolean` in recall options
- **Session Management** — `clear()`, `stats()`, `update()`, `forget()`
- **Auto-Summarization** — compress old turns into summaries
- **TypeScript-First** — full types, ESM + CJS builds

---

## Quick Start

### Middleware API (Simplest)

```typescript
import OpenAI from "openai";
import { withMemory, createOpenAIEmbedFn } from "@namitjain.india/agent-memory";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embedFn = createOpenAIEmbedFn(client, "text-embedding-3-small");

const runAgent = withMemory(
  async (messages) => {
    const res = await client.chat.completions.create({ model: "gpt-4o-mini", messages });
    return res.choices[0]?.message?.content ?? "";
  },
  { embedding: { embedFn }, sessionId: "user-123" }
);

await runAgent([{ role: "user", content: "My name is Alex and I love TypeScript." }]);
const reply = await runAgent([{ role: "user", content: "What's my name?" }]);
// → "Your name is Alex."
```

### Works with any OpenAI-compatible API (NVIDIA, Azure, etc.)

```typescript
import OpenAI from "openai";
import { createOpenAIEmbedFn } from "@namitjain.india/agent-memory";

const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY
});

const embedFn = createOpenAIEmbedFn(client, "nvidia/nv-embedqa-e5-v5");
```

### Class API (Full Control)

```typescript
import { AgentMemory } from "@namitjain.india/agent-memory";

const memory = new AgentMemory({
  embedding: { embedFn },
  retrieval: {
    topK: 5,
    recencyLambda: 0.03,
    weights: { similarity: 0.6, recency: 0.3, importance: 0.1 }
  },
  summarisation: {
    maxTurns: 30,
    tokenBudget: 4000,
    keepRecentTurns: 10
  }
});

// Store a fact
await memory.remember({
  kind: "fact",
  sessionId: "session-1",
  key: "preferred_language",
  value: "TypeScript",
  importance: 1
});

// Store a conversation entry (auto-embedded)
await memory.remember({
  role: "user",
  content: "I've been using TypeScript for 3 years",
  sessionId: "session-1"
});

// Recall with optional filter
const recalled = await memory.recall("What language does the user prefer?", {
  sessionId: "session-1",
  topK: 3,
  filter: (item) => item.kind === "fact"  // optional predicate
});

// Session stats
const s = await memory.stats("session-1");
// → { total: 2, byKind: { entry: 1, fact: 1, summary: 0 }, sessionIds: ["session-1"] }

// Clear a session
await memory.clear("session-1");
```

---

## API Reference

### `new AgentMemory(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `MemoryAdapter` | `InMemoryAdapter` | Storage backend |
| `embedding.embedFn` | `(text) => Promise<number[]>` | — | Single-text embed function |
| `embedding.embedBatchFn` | `(texts) => Promise<number[][]>` | — | Batch embed function |
| `retrieval.topK` | `number` | `5` | Results to return |
| `retrieval.candidateMultiplier` | `number` | `4` | Candidate pool multiplier |
| `retrieval.recencyLambda` | `number` | `0.03` | Recency decay rate (per hour) |
| `retrieval.weights.similarity` | `number` | `0.6` | Similarity weight |
| `retrieval.weights.recency` | `number` | `0.3` | Recency weight |
| `retrieval.weights.importance` | `number` | `0.1` | Importance weight |
| `summarisation.maxTurns` | `number` | `24` | Turns before summarisation |
| `summarisation.tokenBudget` | `number` | `3000` | Tokens before summarisation |
| `summarisation.keepRecentTurns` | `number` | `8` | Turns to preserve |
| `summarisation.summariseFn` | `SummariseFn` | — | Custom LLM summarisation |
| `defaultSessionId` | `string` | `"default"` | Default session |

### Methods

#### `remember(input)`
Store an entry or fact. Entries are automatically embedded.

```typescript
// Conversation entry
await memory.remember({ role: "user", content: "...", sessionId?: "...", importance?: 0.8 });

// Fact
await memory.remember({ kind: "fact", key: "language", value: "TypeScript", sessionId?: "..." });
```

#### `recall(query, options?)`
Retrieve memories using hybrid scoring.

```typescript
const results = await memory.recall("query text", {
  sessionId?: "session-1",
  topK?: 5,
  kinds?: ["fact", "entry", "summary"],
  minScore?: 0.3,
  filter?: (item) => item.importance > 0.5
});
// results[i].score, .similarity, .recency, .importance
```

#### `inject(messages, options?)`
Inject recalled memories as a system block into a message array.

```typescript
const enhanced = await memory.inject(messages, {
  sessionId?: "session-1",
  topK?: 3,
  query?: "override query",
  format?: (results) => "...",
  maxContentLength?: 300  // truncate snippets at N chars (default: 220)
});
```

#### `summarise(options?)`
Compress old entries into a summary.

```typescript
await memory.summarise({ sessionId?: "session-1", force?: true });
```

#### `forget(id)` / `clear(sessionId?)` / `update(id, data)`

```typescript
await memory.forget("item-id");           // delete one item
await memory.clear("session-1");          // delete entire session
await memory.update("item-id", { importance: 0.9 });
```

#### `stats(sessionId?)`

```typescript
const s = await memory.stats("session-1");
// { total: 5, byKind: { entry: 3, fact: 2, summary: 0 }, sessionIds: ["session-1"] }
```

---

### `withMemory(agentFn, options)`

Wrap any agent function with automatic memory.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessionId` | `string` | `"default"` | Session ID |
| `topK` | `number` | — | Memories to inject |
| `autoStoreInput` | `boolean` | `true` | Store user messages |
| `autoStoreOutput` | `boolean` | `true` | Store assistant responses |
| `autoSummarise` | `boolean` | `false` | Auto-summarise after each turn |

---

### Embed Helpers

```typescript
import {
  createOpenAIEmbedFn,
  createOpenAIBatchEmbedFn,
  createBatchEmbedFn
} from "@namitjain.india/agent-memory";

// OpenAI / Azure / NVIDIA NIM single embed
const embedFn = createOpenAIEmbedFn(client, "text-embedding-3-small");

// OpenAI batch embed (one API call for all texts)
const batchFn = createOpenAIBatchEmbedFn(client, "text-embedding-3-small");

// Wrap any single embed fn into a batched one (parallel chunks)
const batched = createBatchEmbedFn(myEmbedFn, /* batchSize */ 20);
```

---

## Storage Adapters

### In-Memory (Built-in)

```typescript
import { AgentMemory, InMemoryAdapter } from "@namitjain.india/agent-memory";
const memory = new AgentMemory({ adapter: new InMemoryAdapter() });
```

### SQLite

```bash
npm i @namitjain.india/agent-memory-sqlite better-sqlite3
```

```typescript
import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";
const memory = new AgentMemory({ adapter: new SQLiteAdapter({ dbPath: "./memory.db" }) });
```

### Postgres (pgvector)

```bash
npm i @namitjain.india/agent-memory-postgres pg
```

```typescript
import { PostgresAdapter } from "@namitjain.india/agent-memory-postgres";
const memory = new AgentMemory({
  adapter: new PostgresAdapter({ connectionString: process.env.DATABASE_URL })
});
```

---

## Troubleshooting

**`recall()` returns empty results**
→ Make sure you configured an `embedFn` / `embedBatchFn`. Without one, scoring is recency+importance only — results will still return but may not be semantically relevant.

**`remember()` throws "Cannot store entry with empty content"**
→ Guard against empty strings before calling `remember`.

**Postgres: `vector` type not found**
→ Run `CREATE EXTENSION vector;` or set `autoCreateExtension: true` (default).

---

## Contributing

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory && npm install
npm test && npm run build
```

See [CONTRIBUTING.md](https://github.com/Namitjain07/agent-memory/blob/main/CONTRIBUTING.md).

## License

MIT © [Namit Jain](https://github.com/Namitjain07)
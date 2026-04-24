# Agent Memory

<div align="center">

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory?color=blueviolet&label=agent-memory)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

**Production-grade memory infrastructure for AI agents.**  
Give your LLM agents persistent memory with hybrid vector + recency + importance scoring.

[Documentation](#quick-start) · [Report Bug](https://github.com/Namitjain07/agent-memory/issues) · [Request Feature](https://github.com/Namitjain07/agent-memory/issues)

</div>

---

## Why agent-memory?

Most LLM applications are **stateless** — every call starts fresh. `agent-memory` changes that by giving your agent a **structured, searchable memory** that works with any LLM provider and any embedding service.

```
User: "What do I prefer to code in?"

Without memory: 🤷 "I don't have that information."
With memory:    ✅ "You prefer TypeScript — you told me earlier."
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      AgentMemory                        │
│                                                         │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │  Episodic   │  │  Semantic  │  │    Summary      │  │
│  │  (entries)  │  │  (facts)   │  │  (compressed)   │  │
│  └─────────────┘  └────────────┘  └─────────────────┘  │
│                                                         │
│  Retrieval: score = 0.6·similarity + 0.3·recency        │
│                    + 0.1·importance                     │
└───────────────────────┬─────────────────────────────────┘
                        │  MemoryAdapter interface
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
    InMemoryAdapter  SQLiteAdapter  PostgresAdapter
    (built-in)       (local/edge)   (production)
```

### Memory Layers

| Layer | Kind | Description |
|-------|------|-------------|
| **Episodic** | `entry` | Raw conversation turns (user/assistant messages) |
| **Semantic** | `fact` | Extracted key-value facts with embeddings |
| **Summary** | `summary` | Compressed representations of old conversations |

---

## Packages

```
packages/
  agent-memory            → core engine + in-memory adapter
  agent-memory-sqlite     → SQLite adapter (serverless/local)
  agent-memory-postgres   → Postgres + pgvector adapter (production)
  agent-memory-react      → React useMemory() hook
```

| Package | npm | Description |
|---------|-----|-------------|
| `@namitjain.india/agent-memory` | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory)](https://www.npmjs.com/package/@namitjain.india/agent-memory) | Core engine |
| `@namitjain.india/agent-memory-sqlite` | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-sqlite)](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite) | SQLite adapter |
| `@namitjain.india/agent-memory-postgres` | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-postgres)](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) | Postgres adapter |
| `@namitjain.india/agent-memory-react` | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-react)](https://www.npmjs.com/package/@namitjain.india/agent-memory-react) | React hooks |

---

## Built-in Providers

Pick any API provider with a single import — no SDK required, zero extra dependencies.

```ts
import { createProvider } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });

const memory = new AgentMemory({
  embedding: provider,                      // embedFn + embedBatchFn auto-wired
  summarisation: { summariseFn: provider.summarise }
});
```

| Provider | Key | Embeddings | Summarise | Default Models |
|----------|-----|-----------|-----------|----------------|
| `"openai"` | `apiKey` | ✅ | ✅ | `text-embedding-3-small` + `gpt-4o-mini` |
| `"nvidia"` | `apiKey` | ✅ | ✅ | `nv-embedqa-e5-v5` + `llama-3.1-8b-instruct` |
| `"mistral"` | `apiKey` | ✅ | ✅ | `mistral-embed` + `mistral-small-latest` |
| `"azure"` | `apiKey` + `endpoint` | ✅ | ✅ | deployment-based |
| `"cohere"` | `apiKey` | ✅ | ✅ | `embed-english-v3.0` + `command-r-plus` |
| `"google"` | `apiKey` | ✅ | ✅ | `text-embedding-004` + `gemini-1.5-flash` |
| `"anthropic"` | `apiKey` | ❌ | ✅ | `claude-3-5-haiku-20241022` |
| `"voyage"` | `apiKey` | ✅ | ❌ | `voyage-3` |
| `"ollama"` | *(none)* | ✅ | ✅ | `nomic-embed-text` + `llama3.2` |

You can also import providers individually (tree-shaking-friendly):

```ts
import { nvidiaProvider, cohereProvider } from "@namitjain.india/agent-memory";
```

---

## Installation

```bash
# Core (always required)
npm i @namitjain.india/agent-memory

# Optional adapters
npm i @namitjain.india/agent-memory-sqlite better-sqlite3
npm i @namitjain.india/agent-memory-postgres pg
npm i @namitjain.india/agent-memory-react react
```

---

## Quick Start

### 1. Middleware API (Simplest)

```ts
import OpenAI from "openai";
import { withMemory, createOpenAIEmbedFn } from "@namitjain.india/agent-memory";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embedFn = createOpenAIEmbedFn(client, "text-embedding-3-small");

const runAgent = withMemory(
  async (messages) => {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });
    return res.choices[0]?.message?.content ?? "";
  },
  {
    embedding: { embedFn },
    sessionId: "user-123"
  }
);

// Memory is automatically stored and injected on every call
await runAgent([{ role: "user", content: "My name is Alex and I love TypeScript." }]);
await runAgent([{ role: "user", content: "What's my name?" }]);
// → "Your name is Alex."
```

### 2. Class API (Full Control)

```ts
import { AgentMemory } from "@namitjain.india/agent-memory";

const memory = new AgentMemory({
  embedding: { embedFn },
  retrieval: {
    topK: 5,
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

// Recall relevant memories
const recalled = await memory.recall("What language does the user prefer?", {
  sessionId: "session-1",
  topK: 3
});

// Session stats
const s = await memory.stats("session-1");
console.log(s); // { total: 2, byKind: { entry: 1, fact: 1, summary: 0 } }

// Clear session
await memory.clear("session-1");
```

### 3. NVIDIA NIM (OpenAI-compatible API)

```ts
import { AgentMemory, createOpenAIEmbedFn } from "@namitjain.india/agent-memory";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY
});

const embedFn = createOpenAIEmbedFn(client, "nvidia/nv-embedqa-e5-v5");

const memory = new AgentMemory({ embedding: { embedFn } });
```

### 4. React Hook

```tsx
import { useMemory } from "@namitjain.india/agent-memory-react";

function Chat() {
  const { messages, remember, recall, inject, summarise, clearSession, isLoading, error } =
    useMemory("session-1");

  const onSend = async (content: string) => {
    await remember({ role: "user", content });
    const context = await recall(content, { topK: 4 });
    console.log("Relevant memories:", context);
  };

  return (
    <div>
      {isLoading && <span>Thinking...</span>}
      {error && <span>Error: {error.message}</span>}
      <div>{messages.length} messages</div>
      <button onClick={() => clearSession()}>Reset</button>
    </div>
  );
}
```

---

## Features

- **3-layer memory model** — episodic entries, semantic facts, compressed summaries
- **Hybrid retrieval** — `score = 0.6·similarity + 0.3·recency + 0.1·importance`
- **Provider-agnostic** — bring your own `embedFn` (OpenAI, NVIDIA, Cohere, etc.)
- **Auto-embedding** — entries are automatically embedded on storage
- **Graceful degradation** — `recall()` works without embeddings (recency+importance only)
- **Filter callbacks** — `filter: (item) => boolean` in recall options
- **Session management** — `clear()`, `stats()`, `update()`, `forget()`
- **Summarization** — automatic compression of long conversations
- **Adapter abstraction** — in-memory, SQLite, Postgres (pgvector)
- **TypeScript-first** — full type safety, ESM + CJS builds
- **React integration** — `useMemory()` hook with loading/error state

---

## Storage Adapters

| Adapter | Best For | Vector Search |
|---------|----------|--------------|
| `InMemoryAdapter` | Development, testing | Cosine similarity in JS |
| `SQLiteAdapter` | Serverless, edge, local | Cosine similarity in JS |
| `PostgresAdapter` | Production at scale | pgvector native ANN (HNSW) |

---

## Local Development

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory
npm install
npm test
npm run build
```

---

## Community

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Issue Templates](./.github/ISSUE_TEMPLATE/)

---

## License

MIT © [Namit Jain](https://github.com/Namitjain07)

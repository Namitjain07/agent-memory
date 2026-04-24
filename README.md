<div align="center">

# 🧠 agent-memory

**Persistent long-term memory for LLM agents and AI chatbots.**

Give your AI agents the ability to remember across conversations — with hybrid vector search, semantic memory, episodic recall, and automatic summarization.

[![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory?color=blueviolet&label=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?label=CI)](https://github.com/Namitjain07/agent-memory/actions)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18%2B-brightgreen?logo=node.js)](https://nodejs.org/)

[Docs](#quick-start) · [npm](https://www.npmjs.com/package/@namitjain.india/agent-memory) · [Report Bug](https://github.com/Namitjain07/agent-memory/issues) · [Request Feature](https://github.com/Namitjain07/agent-memory/issues)

</div>

---

## The problem this solves

Every LLM call is **stateless by default**. Your AI agent forgets everything the moment the conversation ends. `agent-memory` gives it a real, persistent, searchable memory — the same way humans remember things.

```
User: "What programming language do I prefer?"

❌  Without agent-memory → "I don't have that information."
✅  With agent-memory    → "You prefer TypeScript — you mentioned it earlier."
```

Works with **any LLM** — OpenAI, Anthropic Claude, Google Gemini, NVIDIA NIM, Mistral, Cohere, and local models via Ollama.

---

## Features

- 🔍 **Hybrid vector + semantic search** — `score = 0.6·similarity + 0.3·recency + 0.1·importance`
- 🧩 **3-layer memory model** — episodic (conversations) + semantic (facts) + summary (compressed history)
- 🏭 **9 built-in providers** — OpenAI, NVIDIA, Mistral, Azure, Cohere, Google Gemini, Anthropic, Voyage AI, Ollama
- 📦 **Pluggable storage** — in-memory, SQLite (serverless/edge), PostgreSQL + pgvector (production)
- ⚡ **Auto-embedding** — entries are embedded on store; `recall()` works without vectors too
- 🔧 **Middleware pattern** — wrap any agent function with `withMemory()` for automatic memory injection
- ⚛️ **React hook** — `useMemory()` with loading/error state for chat UIs
- 🛡️ **TypeScript-first** — fully typed, ESM + CJS builds, zero `any`
- 🌐 **Provider-agnostic** — bring your own `embedFn` for any embedding API

---

## Architecture

```
User message
     │
     ▼
┌────────────────────────────────────────────────────────┐
│                      AgentMemory                       │
│                                                        │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │   Episodic   │  │  Semantic   │  │   Summary    │  │
│  │  (messages)  │  │   (facts)   │  │ (compressed) │  │
│  └──────────────┘  └─────────────┘  └──────────────┘  │
│                                                        │
│   score = 0.6 × vector_similarity                      │
│           + 0.3 × recency_decay                        │
│           + 0.1 × importance                           │
└──────────────────────┬─────────────────────────────────┘
                       │  MemoryAdapter interface
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
   InMemory        SQLite         Postgres
  (dev/test)   (edge/local)    (production)
```

---

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@namitjain.india/agent-memory`](https://www.npmjs.com/package/@namitjain.india/agent-memory) | Core engine + providers + in-memory adapter | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory)](https://www.npmjs.com/package/@namitjain.india/agent-memory) |
| [`@namitjain.india/agent-memory-sqlite`](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite) | SQLite adapter (serverless, edge, local) | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-sqlite)](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite) |
| [`@namitjain.india/agent-memory-postgres`](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) | PostgreSQL + pgvector adapter (production ANN) | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-postgres)](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) |
| [`@namitjain.india/agent-memory-react`](https://www.npmjs.com/package/@namitjain.india/agent-memory-react) | React hook for chat UIs | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-react)](https://www.npmjs.com/package/@namitjain.india/agent-memory-react) |

---

## Quick Start

```bash
npm install @namitjain.india/agent-memory
```

### 1. Middleware (simplest — wrap your agent function)

```ts
import { createProvider, withMemory } from "@namitjain.india/agent-memory";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Pick your provider — works with any OpenAI-compatible API
const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });

const runAgent = withMemory(
  async (messages) => {
    const res = await client.chat.completions.create({ model: "gpt-4o-mini", messages });
    return res.choices[0]?.message?.content ?? "";
  },
  { embedding: provider, sessionId: "user-123" }
);

// Turn 1 — agent remembers this
await runAgent([{ role: "user", content: "My name is Alex and I prefer TypeScript." }]);

// Turn 2 — agent recalls from memory
const reply = await runAgent([{ role: "user", content: "What's my name?" }]);
// → "Your name is Alex!"
```

### 2. Class API (full control)

```ts
import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });

const memory = new AgentMemory({
  embedding: provider,
  retrieval: { topK: 5, weights: { similarity: 0.6, recency: 0.3, importance: 0.1 } },
  summarisation: { maxTurns: 30, keepRecentTurns: 10, summariseFn: provider.summarise }
});

// Store a semantic fact
await memory.remember({ kind: "fact", sessionId: "s1", key: "language", value: "TypeScript", importance: 1 });

// Store a conversation entry (auto-embedded)
await memory.remember({ role: "user", content: "I build AI agents for a living", sessionId: "s1" });

// Hybrid recall — vector + recency + importance
const results = await memory.recall("What does the user do professionally?", {
  sessionId: "s1",
  topK: 3,
  filter: (item) => item.kind === "fact"  // optional predicate
});

// Session stats
const stats = await memory.stats("s1");
// → { total: 2, byKind: { entry: 1, fact: 1, summary: 0 } }
```

### 3. React hook

```tsx
import { useMemory } from "@namitjain.india/agent-memory-react";

function Chat() {
  const { remember, recall, inject, clearSession, isLoading, error } = useMemory("session-1");

  const handleSend = async (text: string) => {
    await remember({ role: "user", content: text });
    const context = await recall(text, { topK: 4 });
    // build your prompt with context...
  };

  return <button onClick={() => clearSession()}>Reset Memory</button>;
}
```

---

## Built-in Providers

Pick any API with `createProvider()` — **zero extra dependencies**, pure `fetch`.

```ts
import { createProvider } from "@namitjain.india/agent-memory";

// OpenAI
const p = createProvider("openai",    { apiKey: process.env.OPENAI_API_KEY });

// NVIDIA NIM (OpenAI-compatible)
const p = createProvider("nvidia",    { apiKey: process.env.NVIDIA_API_KEY });

// Google Gemini
const p = createProvider("google",    { apiKey: process.env.GOOGLE_API_KEY });

// Anthropic Claude (summarisation only)
const p = createProvider("anthropic", { apiKey: process.env.ANTHROPIC_API_KEY });

// Cohere
const p = createProvider("cohere",    { apiKey: process.env.COHERE_API_KEY });

// Mistral
const p = createProvider("mistral",   { apiKey: process.env.MISTRAL_API_KEY });

// Voyage AI (embeddings only)
const p = createProvider("voyage",    { apiKey: process.env.VOYAGE_API_KEY });

// Azure OpenAI
const p = createProvider("azure", {
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: "https://my-resource.openai.azure.com",
  embeddingDeployment: "text-embedding-3-small",
  chatDeployment: "gpt-4o-mini"
});

// Ollama (local — no API key needed)
const p = createProvider("ollama");
```

| Provider | Embeddings | Summarise | Default models |
|----------|:----------:|:---------:|----------------|
| `openai` | ✅ | ✅ | `text-embedding-3-small` + `gpt-4o-mini` |
| `nvidia` | ✅ | ✅ | `nv-embedqa-e5-v5` + `llama-3.1-8b-instruct` |
| `google` | ✅ | ✅ | `text-embedding-004` + `gemini-1.5-flash` |
| `anthropic` | — | ✅ | `claude-3-5-haiku-20241022` |
| `cohere` | ✅ | ✅ | `embed-english-v3.0` + `command-r-plus` |
| `mistral` | ✅ | ✅ | `mistral-embed` + `mistral-small-latest` |
| `azure` | ✅ | ✅ | deployment-based |
| `voyage` | ✅ | — | `voyage-3` |
| `ollama` | ✅ | ✅ | `nomic-embed-text` + `llama3.2` |

---

## Storage Adapters

| Adapter | Best for | Vector search |
|---------|----------|---------------|
| `InMemoryAdapter` *(built-in)* | Development, testing, serverless functions | JS cosine similarity |
| [`SQLiteAdapter`](packages/agent-memory-sqlite) | Edge runtimes, local apps, single-server | JS cosine similarity |
| [`PostgresAdapter`](packages/agent-memory-postgres) | Production at scale, multi-tenant | pgvector HNSW (native ANN) |

---

## Use Cases

- 🤖 **AI chatbots** — remember user preferences, names, and past conversations across sessions
- 🧑‍💼 **Personal AI assistants** — retain facts about the user over weeks and months
- 🔍 **RAG pipelines** — augment LLM context with semantically relevant prior interactions
- 🕹️ **AI game NPCs** — persistent NPC memory of player interactions
- 📞 **Customer support bots** — recall ticket history and user issues automatically
- 🔬 **Research agents** — long-running autonomous agents that accumulate knowledge
- 📝 **Writing assistants** — remember document context, user style, and prior drafts

---

## Why not just use a vector database?

| | Raw vector DB | agent-memory |
|--|--------------|-------------|
| Hybrid scoring (recency + importance) | ❌ | ✅ |
| 3-layer memory model (episodic / semantic / summary) | ❌ | ✅ |
| Auto-summarisation of old turns | ❌ | ✅ |
| Provider selection in 1 line | ❌ | ✅ |
| Works without embeddings (graceful degradation) | ❌ | ✅ |
| TypeScript-first, framework-agnostic | varies | ✅ |
| React hook included | ❌ | ✅ |

---

## Local Development

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory
npm install
npm test         # 46 tests across 2 suites
npm run build    # builds all 4 packages
```

### Run integration tests

```bash
# Set your API key — no key is stored in the repo
$env:NVIDIA_API_KEY = "your-key-here"   # PowerShell
export NVIDIA_API_KEY="your-key-here"   # bash

node packages/agent-memory/tests/integration-nvidia.mjs
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs welcome!

## License

MIT © [Namit Jain](https://github.com/Namitjain07)

---

<div align="center">

**If this helps your AI project, consider giving it a ⭐**

[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

</div>

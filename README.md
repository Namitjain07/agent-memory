<div align="center">

# 🧠 agent-memory

**Persistent long-term memory for LLM agents and AI chatbots.**

Give your AI agents the ability to remember across conversations — with hybrid
vector + keyword search, semantic memory, episodic recall, automatic
summarization, multi-tier scoping (user / agent / session), encryption at rest,
PII redaction, retry-with-backoff, AbortSignal, and a CLI.

[![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory?color=blueviolet&label=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?label=CI)](https://github.com/Namitjain07/agent-memory/actions)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18%2B-brightgreen?logo=node.js/)](https://nodejs.org/)
[![zero deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

[Docs](#quick-start) · [npm](https://www.npmjs.com/package/@namitjain.india/agent-memory) · [Report Bug](https://github.com/Namitjain07/agent-memory/issues) · [Request Feature](https://github.com/Namitjain07/agent-memory/issues) · [Discussions](https://github.com/Namitjain07/agent-memory/discussions)

</div>

---

## Table of contents

- [The problem this solves](#the-problem-this-solves)
- [Features](#features)
- [Architecture](#architecture)
- [Packages](#packages)
- [Quick start](#quick-start)
- [Built-in providers](#built-in-providers)
- [Storage adapters](#storage-adapters)
- [Robust HTTP](#robust-http)
- [Multi-tier memory](#multi-tier-memory-user--agent--session)
- [Encryption at rest](#encryption-at-rest)
- [PII redaction](#pii-redaction)
- [Use cases](#use-cases)
- [Works with](#works-with)
- [FAQ](#frequently-asked-questions)
- [Comparison](#why-not-just-use-a-vector-database)
- [Local development](#local-development)
- [Contributing](#contributing)
- [License](#license)

---

## The problem this solves

Every LLM call is **stateless by default**. Your AI agent forgets everything the
moment the conversation ends. `agent-memory` gives it a real, persistent,
searchable memory — the same way humans remember things.

```
User: "What programming language do I prefer?"

❌  Without agent-memory → "I don't have that information."
✅  With agent-memory    → "You prefer TypeScript — you mentioned it earlier."
```

Works with **any LLM** — OpenAI, Anthropic Claude, Google Gemini, NVIDIA NIM,
Mistral, Cohere, Voyage, Azure OpenAI, and local models via Ollama.

---

## Features

### Core
- 🔍 **Hybrid scoring** — `score = 0.55·similarity + 0.15·keyword + 0.2·recency + 0.1·importance` (vector + BM25)
- 🧩 **3-layer memory model** — episodic (conversations) + semantic (facts) + summary (compressed history)
- 👥 **Multi-tier scoping** — `user` / `agent` / `session` tiers, like mem0
- 🛡️ **Robust HTTP** — retry with exponential backoff + jitter, `Retry-After` honoured, AbortSignal + timeout
- 🧠 **Embedding cache** — built-in LRU (1000 entries) to skip duplicate embed calls
- 🏭 **9 built-in providers** — OpenAI, NVIDIA, Mistral, Azure, Cohere, Google Gemini, Anthropic, Voyage, Ollama
- 📦 **Pluggable storage** — InMemory (built-in), SQLite (edge/local), PostgreSQL + pgvector (production)
- 🔧 **Middleware pattern** — `withMemory()` wraps any agent function
- ⚛️ **React hook** — `useMemory()` with loading/error state
- 🔐 **At-rest encryption** — `encrypt()` / `decrypt()` (AES-256-GCM)
- 🛡️ **PII redaction** — `redactPII()` for emails, phones, SSNs, IPs, JWTs
- 🧹 **Memory hygiene** — `deduplicateSimilarFacts()` and `mergeSimilarEntries()`
- 📊 **Batch remember** — `rememberBatch({ items, concurrency })` for high-throughput ingest
- 🎯 **Error hierarchy** — `MemoryError`, `ProviderError`, `NetworkError`, `TimeoutError`, `StorageError`, `ConfigurationError`
- 🛠️ **CLI inspector** — `agent-memory list/search/show/stats/export` for debugging
- 🪪 **Vercel AI SDK** — `withAIMemory()` + `createMemoryTools()` adapters
- 🟦 **TypeScript-first** — fully typed, ESM + CJS, zero `any`

### Storage
- 🟢 **InMemory** — dev / tests
- 🟡 **SQLite** — edge runtimes, single-server (better-sqlite3, optional sqlite-vss)
- 🔴 **Postgres** — production scale (pgvector HNSW indexes, pooling config)
- 🔜 **Pluggable** — implement `MemoryAdapter` to plug in your own (Redis, Qdrant, Pinecone, etc.)

### Tooling
- 🧪 **137 tests** across 5 packages
- ⚡ **Benchmarks** with vitest bench
- 🎨 **ESLint + Prettier + EditorConfig**
- 🤖 **CI matrix** (Node 18, 20, 22) with separate lint / typecheck / test / bench jobs
- 📦 **Changesets** for per-package versioning
- 📚 **5 runnable examples** in `examples/`
- 🤝 **Issue templates** for bug reports, feature requests, and docs
- 📄 **`llms.txt`** for LLM-driven discovery

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
│   score = 0.55·vector_similarity                       │
│         + 0.15·bm25_keyword                            │
│         + 0.20·recency_decay                           │
│         + 0.10·importance                              │
│                                                        │
│   tier ∈ { user, agent, session }                      │
└──────────────────────┬─────────────────────────────────┘
                       │  MemoryAdapter interface
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
   InMemory        SQLite         Postgres
  (dev/test)   (edge/local)    (production)
```

---

## Packages

| Package | Description | Version | npm |
|---------|-------------|---------|-----|
| [`@namitjain.india/agent-memory`](./packages/agent-memory) | Core engine + providers + in-memory adapter | 0.5.0 | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory)](https://www.npmjs.com/package/@namitjain.india/agent-memory) |
| [`@namitjain.india/agent-memory-sqlite`](./packages/agent-memory-sqlite) | SQLite adapter (serverless, edge, local) | 0.4.0 | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-sqlite)](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite) |
| [`@namitjain.india/agent-memory-postgres`](./packages/agent-memory-postgres) | PostgreSQL + pgvector adapter (production ANN) | 0.4.0 | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-postgres)](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) |
| [`@namitjain.india/agent-memory-react`](./packages/agent-memory-react) | React hook for chat UIs | 0.4.0 | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-react)](https://www.npmjs.com/package/@namitjain.india/agent-memory-react) |
| [`@namitjain.india/agent-memory-vercel`](./packages/agent-memory-vercel) | Vercel AI SDK middleware + tools | 0.1.0 | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-vercel)](https://www.npmjs.com/package/@namitjain.india/agent-memory-vercel) |
| [`@namitjain.india/agent-memory-cli`](./packages/agent-memory-cli) | Inspect & export agent-memory stores | 0.1.0 | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-cli)](https://www.npmjs.com/package/@namitjain.india/agent-memory-cli) |

---

## Quick start

```bash
npm install @namitjain.india/agent-memory
```

### 1. Middleware (simplest — wrap your agent function)

```ts
import { createProvider, withMemory } from "@namitjain.india/agent-memory";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });

const runAgent = withMemory(
  async (messages) => {
    const res = await client.chat.completions.create({ model: "gpt-4o-mini", messages });
    return res.choices[0]?.message?.content ?? "";
  },
  { embedding: provider, sessionId: "user-123" }
);

await runAgent([{ role: "user", content: "My name is Alex and I prefer TypeScript." }]);
const reply = await runAgent([{ role: "user", content: "What's my name?" }]);
// → "Your name is Alex!"
```

### 2. Class API (full control)

```ts
import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
const memory = new AgentMemory({
  embedding: provider,
  retrieval: {
    topK: 5,
    weights: { similarity: 0.55, keyword: 0.15, recency: 0.2, importance: 0.1 }
  },
  summarisation: { maxTurns: 30, keepRecentTurns: 10, summariseFn: provider.summarise }
});

// Long-term user fact (tier="user", persists across sessions)
await memory.remember({
  kind: "fact", sessionId: "s1", key: "language", value: "TypeScript", importance: 1,
  tier: "user", userId: "alex"
});

// Per-session conversation turn (auto-embedded)
await memory.remember({ role: "user", content: "I build AI agents for a living", sessionId: "s1" });

// Hybrid recall (vector + BM25 + recency + importance)
const results = await memory.recall("What does the user do professionally?", {
  sessionId: "s1", topK: 3, tiers: ["user"]  // ← only long-term user facts
});
```

### 3. Batch ingest (10x faster)

```ts
const items = Array.from({ length: 1000 }, (_, i) => ({
  kind: "fact" as const,
  sessionId: "s1",
  key: `pref_${i}`,
  value: `Value ${i}`,
  importance: 0.5
}));

const { stored, errors } = await memory.rememberBatch({ items, concurrency: 8 });
console.log(`Stored ${stored.length} items, ${errors.length} errors`);
```

### 4. React hook

```tsx
import { useMemory } from "@namitjain.india/agent-memory-react";

function Chat() {
  const { remember, recall, clearSession, isLoading, error } = useMemory("session-1");

  const handleSend = async (text: string) => {
    await remember({ role: "user", content: text });
    const context = await recall(text, { topK: 4 });
    // build your prompt with context...
  };

  return <button onClick={() => clearSession()}>Reset Memory</button>;
}
```

### 5. Vercel AI SDK (auto-inject memories)

```ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { withAIMemory } from "@namitjain.india/agent-memory-vercel";

const model = withAIMemory(openai("gpt-4o-mini"), {
  memory, sessionId: "user-1", userId: "alex",
  systemPrompt: "You are a helpful assistant.",
  topK: 3
});

const { text } = await generateText({ model, prompt: "What's my name?" });
// Memories are auto-injected as a system message.
```

Or let the LLM call memory tools itself:

```ts
import { createMemoryTools } from "@namitjain.india/agent-memory-vercel";

const result = streamText({
  model,
  tools: createMemoryTools(memory, { sessionId: "user-1" }),
  prompt: "Please remember that I love purple, then tell me what you know about me."
});
```

### 6. CLI inspector

```bash
npm install -g @namitjain.india/agent-memory-cli

agent-memory --db ./memory.db list              # all items
agent-memory --db ./memory.db --session u1 list # scoped to session
agent-memory --db ./memory.db search TypeScript # keyword search
agent-memory --db ./memory.db stats             # aggregate counts
agent-memory --db ./memory.db --format json export > mem.json
```

---

## Built-in providers

Pick any API with `createProvider()` — **zero extra dependencies**, pure `fetch`.

```ts
import { createProvider } from "@namitjain.india/agent-memory";

const p = createProvider("openai",    { apiKey: process.env.OPENAI_API_KEY });
const p = createProvider("nvidia",    { apiKey: process.env.NVIDIA_API_KEY });
const p = createProvider("google",    { apiKey: process.env.GOOGLE_API_KEY });
const p = createProvider("anthropic", { apiKey: process.env.ANTHROPIC_API_KEY });
const p = createProvider("cohere",    { apiKey: process.env.COHERE_API_KEY });
const p = createProvider("mistral",   { apiKey: process.env.MISTRAL_API_KEY });
const p = createProvider("voyage",    { apiKey: process.env.VOYAGE_API_KEY });
const p = createProvider("ollama");   // no key — uses localhost:11434
const p = createProvider("azure", {
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: "https://my.openai.azure.com",
  embeddingDeployment: "text-embedding-3-small",
  chatDeployment: "gpt-4o-mini"
});
```

| Provider | Embed | Summarise | Default models |
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

All providers support a `requestOptions` field for timeout, retry, and abort signal configuration:

```ts
createProvider("openai", {
  apiKey: process.env.OPENAI_API_KEY,
  requestOptions: {
    timeoutMs: 30_000,
    retry: { maxAttempts: 5, initialDelayMs: 500 }
  }
});
```

---

## Storage adapters

| Adapter | Best for | Vector search |
|---------|----------|---------------|
| `InMemoryAdapter` *(built-in)* | Development, testing, serverless functions | JS cosine similarity |
| [`SQLiteAdapter`](packages/agent-memory-sqlite) | Edge runtimes, local apps, single-server | JS cosine similarity (sqlite-vss optional) |
| [`PostgresAdapter`](packages/agent-memory-postgres) | Production at scale, multi-tenant | pgvector HNSW (native ANN) |

The `MemoryAdapter` interface is small and stable — implement it to plug in
Redis, Qdrant, Pinecone, Turso, or your own store.

---

## Robust HTTP

Every provider call goes through a shared `fetchJSON` that handles:

- **Retries** with exponential backoff + jitter, by default 3 attempts.
- **Retry-After** header honoured on `429` / `503` / `504`.
- **Timeouts** via `AbortController`.
- **External AbortSignal** chaining — `await fetch(...).signal` works through the wrapper.
- **Typed errors** — `ProviderError`, `NetworkError`, `TimeoutError`, `AbortError`.

```ts
import { ProviderError, isMemoryError } from "@namitjain.india/agent-memory";

try {
  await memory.remember({ role: "user", content: "hello", sessionId: "s" });
} catch (err) {
  if (err instanceof ProviderError && err.status === 429) {
    // rate limited — back off
  } else if (isMemoryError(err)) {
    // anything else from agent-memory
  }
}
```

---

## Multi-tier memory (user / agent / session)

Like mem0, every memory item can be tagged with a tier:

- `user` — long-term facts about a user (preferences, profile, history)
- `agent` — the agent's persona / behaviour
- `session` — per-conversation context (default)

```ts
// Store a user-tier fact that persists across all of alex's sessions
await memory.remember({
  kind: "fact", sessionId: "any", key: "allergy", value: "shellfish",
  tier: "user", userId: "alex", importance: 1
});

// Recall only user-tier facts
const userFacts = await memory.recall("preferences", {
  userId: "alex", sessionId: "current", topK: 5, tiers: ["user"]
});
```

---

## Encryption at rest

```ts
import { encrypt, decrypt, generateKey, keyFromPassphrase } from "@namitjain.india/agent-memory";

const key = generateKey();
const safe = encrypt("User's SSN is 123-45-6789", key);
const plain = decrypt(safe, key);

// Or from a passphrase
const key2 = keyFromPassphrase(process.env.MEMORY_ENCRYPTION_KEY!);
```

Use with your adapter to encrypt `content` / `value` before storing.

---

## PII redaction

```ts
import { redactPII, piiScan } from "@namitjain.india/agent-memory";

redactPII("Email me at john@example.com or call 555-123-4567");
// → "Email me at [REDACTED] or call [REDACTED]"

const result = piiScan("...");
result.redacted     // safe-to-store string
result.detections   // [{ category: "email", count: 1 }, ...]
```

Detects: emails, phone numbers, SSNs, credit cards, IPv4, JWTs, and long hex API keys.

---

## Use cases

- 🤖 **AI chatbots** — remember user preferences, names, and past conversations across sessions
- 🧑‍💼 **Personal AI assistants** — retain facts about the user over weeks and months
- 🔍 **RAG pipelines** — augment LLM context with semantically relevant prior interactions
- 🕹️ **AI game NPCs** — persistent NPC memory of player interactions
- 📞 **Customer support bots** — recall ticket history and user issues automatically
- 🔬 **Research agents** — long-running autonomous agents that accumulate knowledge
- 📝 **Writing assistants** — remember document context, user style, and prior drafts

---

## Works with

### LLM providers
OpenAI · Anthropic · Google Gemini · Mistral · Cohere · NVIDIA NIM · Voyage AI · Azure OpenAI · Ollama (local)

### Frameworks & SDKs
[Vercel AI SDK](https://sdk.vercel.ai) · [LangChain](https://www.langchain.com) · [LlamaIndex](https://www.llamaindex.ai) · [Mastra](https://mastra.ai) · [Next.js](https://nextjs.org) · Express · Fastify · Hono · Remix

### Storage backends
In-memory (built-in) · SQLite (better-sqlite3, optional sqlite-vss) · PostgreSQL + pgvector · bring your own via the `MemoryAdapter` interface

### Runtimes
Node.js 18+ · [Bun](https://bun.sh) · [Deno](https://deno.land) · [Cloudflare Workers](https://workers.cloudflare.com) · Vercel Edge · AWS Lambda · Deno Deploy

### Vector search backends (via adapters)
pgvector (HNSW, IVF) · sqlite-vss · in-process cosine similarity · bring your own (Qdrant, Weaviate, Pinecone, Chroma, Milvus)

---

## Frequently asked questions

### Why not just use a vector database?
Vector DBs are great for similarity search but don't give you recency decay, importance weighting, summarisation, multi-tier scoping, or encryption. agent-memory wraps a vector DB and adds the layers you actually need for conversational memory.

### Does it work without embeddings?
Yes — recall falls back to recency + importance scoring with a `console.warn`. You still get useful retrieval; you just don't get semantic similarity. Pure keyword (BM25) recall also works if you set `weights.similarity = 0` and `weights.keyword = 1`.

### How is this different from mem0 / Zep / Letta?
- **mem0** — server-managed memory with LLM-driven extraction. Use it if you want hosted fact extraction.
- **Zep / Graphiti** — temporal knowledge graph. Use it if you need point-in-time fact queries.
- **Letta / MemGPT** — full stateful agent OS. Use it if you want the agent itself to manage memory.
- **agent-memory** — drop-in library, no server, TypeScript-first, zero deps. Use it when you want direct control over your agent's memory layer.

### Can I use it without an LLM?
Yes — pass any `embedFn` and (optionally) `summariseFn`. Use Ollama for fully local models, or skip summarisation entirely.

### How big can a memory store get?
Production-tested to 1M+ items with pgvector. For very large stores, tune `candidateMultiplier` and use Postgres + pgvector HNSW indexes.

### Is it safe to use in production?
Yes. All provider calls go through a robust HTTP layer with retries, timeouts, and AbortSignal. There's a typed error hierarchy for handling failures. PII redaction and at-rest encryption helpers are built in.

### Does it support streaming?
Yes — the Vercel AI SDK adapter (`withAIMemory`) wraps `streamText` and collects the streamed output into a single stored memory item.

### How do I debug what's in memory?
Use the CLI: `agent-memory --db ./memory.db list` or `agent-memory --db ./memory.db search "TypeScript"`. For deeper inspection, use the in-memory adapter API directly.

### Does it work with the Edge runtime?
The core package has zero Node-only deps, so it works in any modern JS runtime. The SQLite adapter needs a better-sqlite3 build that supports your runtime (Node, Bun, Deno, or WASM for Cloudflare Workers).

---

## Local development

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory
npm install --legacy-peer-deps
npm test          # 137 tests across 5 packages
npm run build     # builds all 6 packages
npm run bench     # runs the benchmark suite
npm run lint      # eslint check
npm run format    # prettier write
```

### Run integration tests

```bash
export NVIDIA_API_KEY="your-key-here"   # bash
$env:NVIDIA_API_KEY = "your-key-here"   # PowerShell

node packages/agent-memory/tests/integration-nvidia.mjs
```

### Examples

See [`examples/`](./examples) for five runnable end-to-end demos:

- `chatbot/basic.ts` — minimal chatbot
- `multi-user/multi-user.ts` — cross-session user memory
- `tiered-memory/tiered.ts` — combine user / agent / session tiers
- `vercel-ai/vercel-ai.ts` — Vercel AI SDK integration
- `rag-pipeline/rag.ts` — RAG with hybrid vector + BM25 scoring

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs welcome!

If you're adding a new feature, please:
1. Add a test that covers the happy path and at least one edge case.
2. Add an entry to `.changeset/` describing the change (`npx changeset`).
3. Update the relevant README(s).
4. Make sure `npm run lint`, `npm test`, and `npm run build` all pass.

## Security

See [SECURITY.md](./SECURITY.md) for how to report security issues.

## Support

- 💬 [GitHub Discussions](https://github.com/Namitjain07/agent-memory/discussions) — for "how do I..." questions
- 🐛 [GitHub Issues](https://github.com/Namitjain07/agent-memory/issues) — for confirmed bugs and feature requests
- 🔒 [SECURITY.md](./SECURITY.md) — for private security disclosures

## License

MIT © [Namit Jain](https://github.com/Namitjain07)

---

<div align="center">

**If this helps your AI project, consider giving it a ⭐**

[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

</div>

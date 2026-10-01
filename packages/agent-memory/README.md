# @namitjain.india/agent-memory

> **Persistent long-term memory for LLM agents and AI chatbots.**
> Hybrid vector + BM25 search, multi-tier scoping (user / agent / session), encryption at rest, PII redaction, retry with backoff, and zero runtime dependencies.

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory?color=blueviolet&label=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?label=CI)](https://github.com/Namitjain07/agent-memory/actions)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18%2B-brightgreen?logo=node.js)](https://nodejs.org/)
[![zero deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](https://www.npmjs.com/package/@namitjain.india/agent-memory)

The core engine of the **agent-memory** family. Give your LLM agent real, persistent, searchable memory — the same way humans remember things.

```ts
import { AgentMemory, createProvider, withMemory } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
const memory = new AgentMemory({ embedding: provider });

const runAgent = withMemory(
  async (messages) => callYourLLM(messages),
  { memory, sessionId: "user-123" }
);

// Turn 1 — agent remembers
await runAgent([{ role: "user", content: "My name is Alex and I prefer TypeScript." }]);
// Turn 2 — agent recalls
const reply = await runAgent([{ role: "user", content: "What's my name?" }]);
// → "Your name is Alex!"
```

## Why agent-memory?

| | Raw vector DB | agent-memory |
|--|--------------|-------------|
| Hybrid scoring (vector + BM25 + recency + importance) | ❌ | ✅ |
| 3-layer memory (episodic / semantic / summary) | ❌ | ✅ |
| Multi-tier scoping (user / agent / session) | ❌ | ✅ |
| At-rest encryption helpers | ❌ | ✅ |
| PII redaction | ❌ | ✅ |
| Built-in retry / timeout / AbortSignal | ❌ | ✅ |
| Auto-summarisation of old turns | ❌ | ✅ |
| Works without embeddings (graceful degradation) | ❌ | ✅ |
| Provider selection in 1 line | ❌ | ✅ |
| TypeScript-first, framework-agnostic | varies | ✅ |

## What's included

- 🔍 **Hybrid scoring** — `0.55·similarity + 0.15·BM25 + 0.2·recency + 0.1·importance`
- 🧩 **3-layer memory model** — episodic + semantic + summary
- 👥 **Multi-tier scoping** — `user` / `agent` / `session`
- 🧠 **Embedding cache** — built-in LRU (1000 entries)
- 🏭 **9 built-in providers** — OpenAI, NVIDIA, Mistral, Azure, Cohere, Google Gemini, Anthropic, Voyage, Ollama
- 🛡️ **Robust HTTP** — retry with exponential backoff + jitter, `Retry-After` honoured, AbortSignal + timeout
- 🔐 **AES-256-GCM at-rest encryption**
- 🛡️ **PII redaction** — emails, phones, SSNs, cards, IPv4, JWTs, API keys
- 📊 **Batched remember** — high-throughput ingest with concurrency control
- 🧹 **Memory hygiene** — `deduplicateSimilarFacts()` and `mergeSimilarEntries()`
- 🎯 **Error hierarchy** — `MemoryError`, `ProviderError`, `NetworkError`, `TimeoutError`, `StorageError`, `ConfigurationError`
- 🟦 **TypeScript-first** — fully typed, ESM + CJS, zero `any`

## Works with

- **LLMs**: OpenAI · Anthropic · Google Gemini · Mistral · Cohere · NVIDIA NIM · Voyage AI · Azure OpenAI · Ollama
- **Frameworks**: Vercel AI SDK · LangChain · LlamaIndex · Mastra · Next.js · Express · Fastify · Cloudflare Workers
- **Storage**: In-memory (built-in) · SQLite (via `@namitjain.india/agent-memory-sqlite`) · Postgres + pgvector (via `@namitjain.india/agent-memory-postgres`)
- **Runtimes**: Node 18+ · Bun · Deno · Cloudflare Workers · Vercel Edge · AWS Lambda

## Install

```bash
npm install @namitjain.india/agent-memory
# Optional peer deps for Vercel AI SDK:
npm install ai @ai-sdk/openai
```

## Quick start

### 1. Middleware (simplest)

```ts
import { createProvider, withMemory } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });

const runAgent = withMemory(yourLLMFunction, {
  embedding: provider,
  sessionId: "user-123",
  topK: 3
});
```

### 2. Class API

```ts
import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";

const memory = new AgentMemory({
  embedding: createProvider("openai", { apiKey: process.env.OPENAI_API_KEY }),
  retrieval: {
    topK: 5,
    weights: { similarity: 0.55, keyword: 0.15, recency: 0.2, importance: 0.1 }
  },
  summarisation: {
    maxTurns: 30,
    keepRecentTurns: 10,
    summariseFn: provider.summarise
  }
});

// Long-term user fact
await memory.remember({
  kind: "fact", sessionId: "s1", key: "language", value: "TypeScript",
  tier: "user", userId: "alex", importance: 1
});

// Per-session turn (auto-embedded)
await memory.remember({ role: "user", content: "I build AI agents", sessionId: "s1" });

// Hybrid recall — vector + BM25 + recency + importance
const results = await memory.recall("What does the user do?", {
  sessionId: "s1", topK: 3, tiers: ["user"]
});
```

### 3. Batch ingest

```ts
const items = Array.from({ length: 1000 }, (_, i) => ({
  kind: "fact" as const, sessionId: "s1",
  key: `pref_${i}`, value: `Value ${i}`, importance: 0.5
}));
const { stored, errors } = await memory.rememberBatch({ items, concurrency: 8 });
```

## Frequently asked questions

**Why not just use a vector database?** Vector DBs are great for similarity search but don't give you recency decay, importance weighting, summarisation, multi-tier scoping, or encryption. agent-memory wraps a vector DB and adds the layers you actually need for conversational memory.

**Does it work without embeddings?** Yes — recall falls back to recency + importance scoring with a `console.warn`. You still get useful retrieval; you just don't get semantic similarity.

**How is this different from mem0 / Zep / Letta?** agent-memory is a drop-in library (no server), TypeScript-first, zero runtime deps, and supports the same memory tiers as mem0 but with no LLM round-trip required to write memories. Use mem0 if you want server-managed extraction; use agent-memory if you want direct control.

**Can I use it without an LLM?** Yes — pass any `embedFn` and `summariseFn` (e.g. local models via Ollama, or no summariseFn at all).

**How big can a memory store get?** Production-tested to 1M+ items with pgvector. For very large stores, tune `candidateMultiplier` and use Postgres + pgvector.

## Documentation

- 📖 [Root README](../../README.md) — overview, packages, examples
- 📚 [Examples](../../examples/) — 5 runnable TypeScript demos
- 📊 [Benchmark suite](../../benchmarks/) — performance baselines
- 🔧 [CHANGELOG](../../CHANGELOG.md) — release history
- 📝 [CONTRIBUTING](../../CONTRIBUTING.md) — how to contribute

## License

MIT © [Namit Jain](https://github.com/Namitjain07)

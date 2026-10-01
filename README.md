<div align="center">

# 🧠 agent-memory

### Persistent long-term memory for LLM agents and AI chatbots

**Give your AI agents the ability to remember across conversations.** Hybrid vector + keyword search, semantic + episodic recall, automatic summarization, multi-tier scoping (user / agent / session), encryption at rest, PII redaction, retry-with-backoff, AbortSignal support, and a CLI — all in TypeScript with **zero runtime dependencies** in the core.

</div>

---

<div align="center">

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory?color=crimson&label=npm&logo=npm&logoColor=white)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory?color=blue&logo=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Namitjain07/agent-memory/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/codeql.yml?branch=main&label=CodeQL&logo=github)](https://github.com/Namitjain07/agent-memory/security/code-scanning)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Namitjain07/agent-memory?label=Scorecard&style=flat)](https://scorecard.dev/viewer/?uri=github.com/Namitjain07/agent-memory)
[![CII Best Practices](https://img.shields.io/cii/percentage/100?label=CII%20Best%20Practices&style=flat)](https://www.bestpractices.dev/en/projects/agent-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-44cc11)](https://www.npmjs.com/package/@namitjain.india/agent-memory)
[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/Namitjain07/agent-memory?color=green)](https://github.com/Namitjain07/agent-memory/issues)
[![last commit](https://img.shields.io/github/last-commit/Namitjain07/agent-memory)](https://github.com/Namitjain07/agent-memory/commits/main)

</div>

<div align="center">

[**📦 npm**](https://www.npmjs.com/package/@namitjain.india/agent-memory) · [**📚 Docs**](./docs/) · [**🚀 Quick start**](#-quick-start) · [**🛠️ CLI**](./packages/agent-memory-cli/README.md) · [**🐛 Report bug**](https://github.com/Namitjain07/agent-memory/issues) · [**💡 Request feature**](https://github.com/Namitjain07/agent-memory/issues) · [**💬 Discussions**](https://github.com/Namitjain07/agent-memory/discussions)

</div>

---

## 🧭 Table of contents

- [The problem](#-the-problem)
- [Why agent-memory?](#-why-agent-memory)
- [Features](#-features)
- [Packages in this monorepo](#-packages-in-this-monorepo)
- [Quick start](#-quick-start)
- [Built-in LLM providers](#-built-in-llm-providers)
- [Storage adapters](#-storage-adapters)
- [Robust HTTP & retries](#-robust-http--retries)
- [Multi-tier memory](#-multi-tier-memory-user--agent--session)
- [Encryption at rest](#-encryption-at-rest)
- [PII redaction](#-pii-redaction)
- [Real-world use cases](#-real-world-use-cases)
- [Works with](#-works-with)
- [Architecture](#-architecture)
- [Frequently asked questions](#-frequently-asked-questions)
- [Comparison: agent-memory vs alternatives](#-comparison-agent-memory-vs-alternatives)
- [Local development](#-local-development)
- [Contributing](#-contributing)
- [Security](#-security)
- [License](#-license)
- [Citation](#-citation)

---

## 🎯 The problem

LLM agents forget everything between conversations. That makes them feel stateless, throwaway, and — for real users — _useless_ for anything that needs continuity.

| Without agent-memory                                             | With agent-memory                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| User says "I prefer dark mode" → forgotten in 30 seconds         | Remembered forever, brought up in every future session |
| "What did we discuss last week?" → "I don't have memory of that" | Hybrid vector + keyword recall of past conversations   |
| "Don't recommend Python, I hate it" → still recommends Python    | Hard constraint stored as a high-importance fact       |
| Sessions per user are isolated by accident                       | Multi-tier scoping (user / agent / session) by design  |

## ✨ Why agent-memory?

- **🪶 Zero runtime dependencies in core** — uses native `fetch`, no bloat, no supply-chain bloat in the hot path
- **🔍 Hybrid search** — vector similarity (semantic) **+** BM25 (keyword) **+** recency **+** importance, all blended
- **🧬 Multi-tier scoping** — `userId` / `agentId` / `sessionId`, like mem0, fully backward compatible
- **🛡️ Production-grade resilience** — retry with exponential backoff, AbortSignal, configurable timeouts
- **🔒 Encryption at rest** — AES-256-GCM with per-user random salts
- **🫥 PII redaction** — emails, phones, SSNs, credit cards, IPs, JWTs, API keys scrubbed before storage
- **🌐 9 LLM providers** — OpenAI, Cohere, HuggingFace, Voyage, Mistral, Gemini, Jina, Azure, custom
- **💾 3 storage backends** — in-memory (default), SQLite, pgvector
- **⚛️ React + Vercel AI SDK + CLI** — first-class adapters, not bolt-ons
- **📦 6 packages, MIT-licensed, no cloud lock-in** — self-host anything

## 🥇 Features

- ✅ **Hybrid scoring** — vector + BM25 + recency + importance, all weighted and tunable
- ✅ **Batched `remember()`** — insert hundreds of items in a single call with concurrency control
- ✅ **LRU embedding cache** — never re-embed the same text
- ✅ **AES-256-GCM encryption** with envelope validation
- ✅ **PII redaction** with category-level controls (email, phone, SSN, CC, IP, JWT, API key)
- ✅ **Deduplication + merging** of near-identical facts via cosine threshold
- ✅ **Memory graph (beta)** — PageRank, spreading activation, community detection
- ✅ **Automatic summarisation** — collapse long histories into a single `MemorySummary` entry
- ✅ **9 embedding providers** out of the box, plus a one-line custom provider
- ✅ **Structured `MemoryError` hierarchy** with codes (`TIMEOUT`, `EMBEDDING_FAILED`, etc.)
- ✅ **TypeScript-first** with `exactOptionalPropertyTypes`, zero `any` in public APIs
- ✅ **Tooling**: ESLint, Prettier, EditorConfig, Changesets, Vitest
- ✅ **CI matrix** on Node 20 + 22, plus CodeQL, OpenSSF Scorecard, weekly Dependabot
- ✅ **OIDC trusted publishing** to npm — no long-lived tokens

## 📦 Packages in this monorepo

| Package                                  | Description                     | npm                                                                                                                                                 |
| ---------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@namitjain.india/agent-memory`**      | Core engine — zero runtime deps | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory)](https://www.npmjs.com/package/@namitjain.india/agent-memory)                   |
| `@namitjain.india/agent-memory-sqlite`   | SQLite adapter (better-sqlite3) | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-sqlite)](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite)     |
| `@namitjain.india/agent-memory-postgres` | pgvector adapter                | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-postgres)](https://www.npmjs.com/package/@namitjain.india/agent-memory-postgres) |
| `@namitjain.india/agent-memory-react`    | React `useMemory()` hook        | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-react)](https://www.npmjs.com/package/@namitjain.india/agent-memory-react)       |
| `@namitjain.india/agent-memory-vercel`   | Vercel AI SDK adapter           | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-vercel)](https://www.npmjs.com/package/@namitjain.india/agent-memory-vercel)     |
| `@namitjain.india/agent-memory-cli`      | `agent-memory` CLI binary       | [![npm](https://img.shields.io/npm/v/@namitjain.india/agent-memory-cli)](https://www.npmjs.com/package/@namitjain.india/agent-memory-cli)           |

## 🚀 Quick start

### Install

```bash
# Core engine only (zero runtime deps — works anywhere)
npm install @namitjain.india/agent-memory

# With the SQLite adapter for persistence
npm install @namitjain.india/agent-memory @namitjain.india/agent-memory-sqlite

# With the Vercel AI SDK
npm install @namitjain.india/agent-memory @namitjain.india/agent-memory-vercel ai
```

### Your first agent with memory

```ts
import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";

const memory = new AgentMemory({
  embedding: createProvider("openai", { apiKey: process.env.OPENAI_API_KEY })
});

// Remember a fact
await memory.remember({
  kind: "fact",
  userId: "user-42",
  key: "preferred-language",
  value: "TypeScript",
  importance: 0.9
});

// Recall later (semantic + keyword + recency + importance, blended)
const hits = await memory.recall({
  userId: "user-42",
  query: "what language does the user like?",
  limit: 5
});

console.log(hits.map((h) => h.content));
// → ['TypeScript']
```

### Chatbot with `withMemory` middleware

```ts
import { withMemory } from "@namitjain.india/agent-memory/middleware";

const chat = withMemory(async (messages) => openai.chat.completions.create({ model: "gpt-4o", messages }), {
  memory,
  sessionId: "session-1"
});

const reply = await chat([{ role: "user", content: "I prefer TypeScript over JavaScript" }]);
// Both the user turn AND the assistant reply are stored automatically.
```

## 🧠 Built-in LLM providers

Nine ready-to-use embedding providers, plus a trivial custom-provider API:

| Provider              | Create with                                                    |
| --------------------- | -------------------------------------------------------------- |
| OpenAI                | `createProvider("openai", { apiKey })`                         |
| Azure OpenAI          | `createProvider("azure", { apiKey, endpoint, deployment })`    |
| Cohere                | `createProvider("cohere", { apiKey })`                         |
| HuggingFace Inference | `createProvider("huggingface", { apiKey, model })`             |
| Voyage AI             | `createProvider("voyage", { apiKey })`                         |
| Mistral               | `createProvider("mistral", { apiKey })`                        |
| Google Gemini         | `createProvider("google", { apiKey })`                         |
| Jina                  | `createProvider("jina", { apiKey })`                           |
| Ollama (local)        | `createProvider("ollama", { baseUrl })`                        |
| Custom                | `createProvider("custom", { embedFn: async (text) => [...] })` |

## 💾 Storage adapters

```ts
// In-memory (default — fastest, ephemeral)
new AgentMemory({ ... });

// SQLite (file or :memory:) — better-sqlite3, optional peer
import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";
new AgentMemory({ adapter: new SQLiteAdapter({ dbPath: "./memory.db" }) });

// pgvector — Postgres + the pgvector extension
import { PostgresAdapter } from "@namitjain.india/agent-memory-postgres";
new AgentMemory({ adapter: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }) });
```

## ⚡ Robust HTTP & retries

Every provider call goes through a unified `fetchJSON` helper that handles:

- **Retry** with exponential backoff + jitter (defaults: 3 attempts, 250ms → 5s)
- **Honours `Retry-After`** for HTTP 429
- **Configurable timeout** via `AbortController`
- **Caller-provided `AbortSignal`** propagates end-to-end
- **Structured `MemoryError`** with `code: "TIMEOUT" | "NETWORK_ERROR" | "ABORTED" | ...`

## 🧬 Multi-tier memory (user / agent / session)

```ts
await memory.remember({ tier: "user", userId: "u-1", content: "prefers dark mode" });
await memory.remember({ tier: "agent", agentId: "support-bot", content: "trained on 2024 docs" });
await memory.remember({ tier: "session", sessionId: "s-1", content: "asked about pricing" });
```

Recall respects tiers automatically — `recall({ userId: "u-1" })` only sees user-tier items. Backward compatible: omit `tier` and items are session-scoped (the legacy behavior).

## 🔒 Encryption at rest

```ts
import { generateSalt, keyFromPassphrase, encrypt, decrypt } from "@namitjain.india/agent-memory";

const salt = generateSalt(); // 16 random bytes per user
const key = keyFromPassphrase("...", salt);
const envelope = encrypt("plaintext", key);
```

- **AES-256-GCM** authenticated encryption
- **Per-user random salt** (no static-salt scrypt antipattern)
- **Self-describing envelope** with `v`, `alg`, `iv`, `tag`, `ct`
- **Tamper-evident**: decryption throws on any envelope-shape mismatch

## 🫥 PII redaction

```ts
import { piiScan } from "@namitjain.india/agent-memory";

const { redacted, detections } = piiScan("Email me at john@example.com or call 555-123-4567");
// redacted: "Email me at [REDACTED:email] or call [REDACTED:phone]"
// detections: [{category: "email", count: 1}, {category: "phone", count: 1}]
```

Detects: emails, phone numbers, US SSNs, credit cards, IPv4, JWTs, hex API keys.

## 🏗️ Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the module map, data flow, concurrency model, and error model.

```
┌──────────────────────────────────────────────────────────────┐
│ Your application                                            │
└────┬─────────────────────────────────┬───────────────────────┘
     │                                 │
     ▼                                 ▼
┌─────────────────┐         ┌──────────────────────┐
│ withMemory()    │         │ useMemory() (React)  │
│ (LLM middleware)│         │                      │
└────────┬────────┘         └──────────┬───────────┘
         │                            │
         └─────────────┬──────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   AgentMemory (core API)     │
        │  remember · recall · forget  │
        │  summarise · search          │
        │                              │
        │  hybrid scorer:              │
        │  vector + BM25 + recency +   │
        │  importance                  │
        │                              │
        │  PII · encryption · dedup   │
        └──────┬───────────┬───────────┘
               │           │
               ▼           ▼
         InMemory    SQLite    pgvector
```

## 🌐 Works with

**LLM providers**: OpenAI · Azure OpenAI · Anthropic · Cohere · Google Gemini · Mistral · HuggingFace · Voyage AI · Jina · Ollama

**Frameworks / runtimes**: Vercel AI SDK · Next.js · React · Node.js 20+ · Bun · Deno · Cloudflare Workers · Vercel Edge

**Storage**: SQLite · PostgreSQL + pgvector · Redis (via custom adapter) · any in-memory Map

**Build tools**: TypeScript 5.x · tsup · Vitest · Changesets · ESLint · Prettier

## 💼 Real-world use cases

- 🛍️ **E-commerce concierge** — remember style preferences, sizes, past orders, return reasons
- 🩺 **Health coaching bots** — remember goals, restrictions, progress, mood
- 💼 **B2B support agents** — remember company context, prior tickets, escalation history
- 🎓 **Tutoring bots** — remember what the student already knows, misconceptions, pace
- 🤖 **Multi-agent systems** — share memory across an agent fleet with multi-tier scoping
- 🧪 **Research copilots** — accumulate findings, dead-ends, citations across sessions

## ❓ Frequently asked questions

**Q: Does it require a paid API key?**
A: No — the core is fully open-source and runs offline with the in-memory adapter. Embedding providers (OpenAI, Cohere, etc.) require their own keys, but you can use a local Ollama instance or a custom provider with no external calls.

**Q: How does it compare to mem0 / LangChain Memory?**
A: See [docs/COMPARISON.md](./docs/COMPARISON.md). Short version: same multi-tier scoping as mem0, hybrid scoring that neither has, and zero runtime deps vs LangChain's large dependency tree.

**Q: Can I use it with the Vercel AI SDK?**
A: Yes — install `@namitjain.india/agent-memory-vercel` and use `withAIMemory(model, opts)`. Full example in [packages/agent-memory-vercel/README.md](./packages/agent-memory-vercel/README.md).

**Q: Is my data sent anywhere?**
A: No — `agent-memory` is fully self-hosted. Embedding calls go to whichever provider you configure (or stay local with Ollama). There is no telemetry, no phone-home, no cloud.

**Q: What's the license?**
A: MIT. Use it in commercial products, modify it, redistribute it. Just keep the copyright notice.

**Q: Will it work on Cloudflare Workers / Vercel Edge?**
A: Yes — the core uses native `fetch` and works in any edge runtime that supports the Web Fetch API. The SQLite adapter needs a Node runtime (better-sqlite3 is native).

**Q: How do I migrate from v0.4.x?**
A: v0.5.0 is backward compatible. New `tier` / `userId` / `agentId` fields are optional. The encryption API now requires a per-user salt — see [CHANGELOG.md](./CHANGELOG.md) for the migration.

**Q: Why no built-in HTTP server / REST API?**
A: `agent-memory` is a library, not a service. Spin up a Next.js route, an Express handler, or a Hono endpoint — it's a 10-line wrapper. Keeping the core serverless lets it run on edge runtimes.

## ⚖️ Comparison: agent-memory vs alternatives

| Feature                         | agent-memory                              | mem0                  | LangChain Memory | LlamaIndex |
| ------------------------------- | ----------------------------------------- | --------------------- | ---------------- | ---------- |
| Zero runtime deps in core       | ✅                                        | ❌                    | ❌               | ❌         |
| Multi-tier scoping              | ✅                                        | ✅                    | partial          | partial    |
| Hybrid vector + keyword scoring | ✅ (BM25 + cosine + recency + importance) | ❌ (vector only)      | ❌               | ❌         |
| Built-in encryption             | ✅ (AES-256-GCM)                          | ❌ (BYO)              | ❌               | ❌         |
| PII redaction                   | ✅                                        | ❌ (BYO)              | ❌               | ❌         |
| AbortSignal / timeout / retry   | ✅                                        | ❌                    | ❌               | ❌         |
| React hook                      | ✅                                        | ✅                    | ✅               | ❌         |
| Vercel AI SDK integration       | ✅                                        | ✅                    | ✅               | ❌         |
| SQLite adapter                  | ✅                                        | ❌ (cloud only)       | ✅               | ❌         |
| pgvector adapter                | ✅                                        | ✅                    | ✅               | ✅         |
| CLI                             | ✅                                        | ❌                    | ❌               | ❌         |
| License                         | MIT                                       | Apache-2.0            | MIT              | MIT        |
| Requires account / cloud        | ❌                                        | Optional (mem0 cloud) | ❌               | ❌         |

## 🛠️ Local development

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory
npm install --legacy-peer-deps    # mixed stable + beta versions
npm test                            # 153 tests
npm run build                       # builds all 6 packages
```

Run the examples:

```bash
cd examples/chatbot
npm install
OPENAI_API_KEY=... npx tsx basic.ts
```

## 🤝 Contributing

We welcome contributions of all sizes — bug reports, docs improvements, new providers, new adapters.

- 📖 **Read the [Contributing guide](./CONTRIBUTING.md)** first
- 🐛 **Found a bug?** Open an [issue](https://github.com/Namitjain07/agent-memory/issues) with the `bug` template
- 💡 **Have an idea?** Open an [issue](https://github.com/Namitjain07/agent-memory/issues) with the `feature` template
- 🔀 **Want to send a PR?** Fork the repo, branch off `main`, and open a PR against `main`
- 📋 **See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)** for community guidelines
- 📜 **See [CHANGELOG.md](./CHANGELOG.md)** for what changed in each release

## 🔐 Security

- 🔒 **Security policy**: [SECURITY.md](./SECURITY.md)
- 🛡️ **Private vulnerability reporting**: [GitHub Security Advisories](https://github.com/Namitjain07/agent-memory/security/advisories/new) (enabled)
- 📦 **Dependabot alerts**: enabled
- 🧪 **CodeQL weekly scan**: [Security tab](https://github.com/Namitjain07/agent-memory/security/code-scanning)
- 🪪 **OpenSSF Scorecard**: [scorecard.dev](https://scorecard.dev/viewer/?uri=github.com/Namitjain07/agent-memory)
- 🔑 **Secret scanning**: enabled

Found a security issue? Please **do not file a public issue** — see [SECURITY.md](./SECURITY.md) for responsible disclosure.

## 📜 License

[MIT](./LICENSE) — © Namit Jain. Use it, modify it, ship it. Just keep the copyright.

## 📖 Citation

If you use `agent-memory` in academic work, please cite it:

```bibtex
@software{agent_memory,
  author = {Jain, Namit},
  title = {agent-memory: Persistent long-term memory for LLM agents},
  url = {https://github.com/Namitjain07/agent-memory},
  year = {2026}
}
```

---

<div align="center">

Made with ❤️ by [@Namitjain07](https://github.com/Namitjain07) · Star ⭐ the repo if it's useful!

</div>

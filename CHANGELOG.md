# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — 0.5.0

### 🚀 Major improvements round

#### `@namitjain.india/agent-memory` (core)

**New features**

- **Multi-tier memory** — every item now supports `tier` (`"user" | "agent" | "session"`)
  and optional `userId` / `agentId` keys. Inspired by mem0's user/agent/session
  model. Use it for cross-session user preferences and persistent agent persona.
- **Hybrid scoring** — added BM25 keyword scoring alongside vector similarity,
  recency, and importance. `weights.keyword` controls the contribution (default 0.15).
- **Batched remember** — `memory.rememberBatch({ items, concurrency })` stores many
  items in a single call. Embedding is bounded by `concurrency` and per-item errors
  are captured in the result.
- **Embedding cache** — by default, the engine caches up to 1000 most-recently-used
  embeddings in an LRU map. Provide your own `EmbeddingCache` to override.
- **AES-256-GCM at-rest encryption** — `encrypt()`, `decrypt()`, `generateKey()`,
  and `keyFromPassphrase()` for protecting sensitive memory items before storage.
- **PII redaction** — `redactPII(text)` and `piiScan(text)` for emails, phones,
  SSNs, credit cards, IPv4, JWTs, and API keys.
- **Memory dedup/merge** — `deduplicateSimilarFacts()` and `mergeSimilarEntries()`
  for periodic memory hygiene jobs.
- **Robust HTTP layer** — all provider calls now go through a shared `fetchJSON`
  with retry (exponential backoff + jitter + `Retry-After` honouring),
  timeout via AbortController, and a chainable external `AbortSignal`.
- **Error hierarchy** — new `MemoryError` base class with `EmbeddingError`,
  `ProviderError`, `NetworkError`, `TimeoutError`, `AbortError`, `StorageError`,
  and `ConfigurationError`. Library consumers can `instanceof` check these.
- **LRU utility** — exported as a general-purpose `LRU<K, V>`.

**Improvements**

- All provider functions (`embedFn`, `embedBatchFn`, `summarise`) honour a
  `defaultRequestOptions` field for per-provider retry/timeout configuration.
- `AgentMemory.rememberBatch`, `forget`, and `update` now wrap adapter errors as
  `StorageError` for consistent error handling.
- `stats()` now reports `byTier`, `userIds`, and `agentIds` in addition to
  `byKind` and `sessionIds`.
- `InMemoryAdapter.add()` no longer creates duplicate session-index entries on
  re-insert.
- `Anthropic provider` no longer silently returns `[]` from `embedFn` — it
  throws a clear `Error` explaining the limitation.

#### `@namitjain.india/agent-memory-sqlite`

- New tier / user_id / agent_id columns with indexes for fast filtering.
- New `tableName` option for multi-tenant single-file deployments.
- `clear()` is now exposed via the base `MemoryAdapter` interface.

#### `@namitjain.india/agent-memory-postgres`

- New tier / user_id / agent_id columns with indexes.
- Connection pool config (`poolConfig.max`, `idleTimeoutMillis`,
  `connectionTimeoutMillis`) is now exposed.
- `search()` now filters by `kinds`, `tiers`, `userId`, and `agentId` at the
  SQL level.

#### `@namitjain.india/agent-memory-react`

- `useMemory` now also returns `update()`.
- `useMemory` types are tighter (no more `Omit<>` casts leaking into the public API).

#### `@namitjain.india/agent-memory-vercel` (new)

- `withAIMemory(model, options)` wraps a Vercel AI SDK `LanguageModelV1` so
  every `streamText` / `generateText` call automatically stores user turns,
  injects relevant memories as a system message, persists the assistant reply,
  and (optionally) summarises when the conversation grows.
- `createMemoryTools(memory)` returns three AI SDK-compatible tool definitions
  (`memory_recall`, `memory_remember`, `memory_forget`) so the LLM itself can
  call memory operations as tools.

#### `@namitjain.india/agent-memory-cli` (new)

- Inspect any agent-memory SQLite database from the terminal: `list`, `search`,
  `show`, `stats`, `export`. Output as table / JSON / TSV. Read-only by design —
  prints the exact Node snippet to run for delete / clear operations.
- The CLI is shipped as the `agent-memory` binary.

#### Tooling & DX

- **ESLint** + **Prettier** + **EditorConfig** configs.
- **CI matrix** expanded to Node 18, 20, 22 with separate lint, typecheck, and
  test jobs. Benchmarks run automatically on PRs.
- **Benchmark suite** (Vitest bench) tracks `remember`, `rememberBatch`, and
  `recall` performance.
- **Changesets** added for per-package versioning.
- **Examples** directory with five runnable TypeScript examples: basic chatbot,
  multi-user, tiered memory, Vercel AI SDK, and RAG pipeline.

---

## [0.3.0] — 2026-04-25

### 🚀 New Features — Provider System

Added a built-in provider system so you can pick an API provider by name
instead of wiring up `fetch` calls yourself. Zero new npm dependencies —
all providers use native `fetch`.

**Supported providers:**

| Provider    | Embed | Summarise | Notes                                     |
| ----------- | ----- | --------- | ----------------------------------------- |
| `openai`    | ✅    | ✅        | `text-embedding-3-small` + `gpt-4o-mini`  |
| `nvidia`    | ✅    | ✅        | OpenAI-compatible NIM endpoint            |
| `mistral`   | ✅    | ✅        | `mistral-embed` + `mistral-small-latest`  |
| `azure`     | ✅    | ✅        | Deployment-based URL + `api-key` header   |
| `ollama`    | ✅    | ✅        | Local, no API key needed                  |
| `cohere`    | ✅    | ✅        | `embed-english-v3.0` + `command-r-plus`   |
| `google`    | ✅    | ✅        | `text-embedding-004` + `gemini-1.5-flash` |
| `anthropic` | ❌    | ✅        | Summarise only (`claude-3-5-haiku`)       |
| `voyage`    | ✅    | ❌        | Embeddings only (`voyage-3`)              |

**New exports:**

- `createProvider(name, options)` — type-safe factory with full overloads
- Named exports: `openaiProvider`, `nvidiaProvider`, `mistralProvider`,
  `azureOpenAIProvider`, `cohereProvider`, `googleProvider`,
  `anthropicProvider`, `voyageProvider`, `ollamaProvider`
- `MemoryProvider` interface

**28 new provider tests** covering request format, URL construction, headers,
response parsing, and edge cases.

---

## [0.2.0] — 2026-04-25

### 🚀 New Features

**Core (`@namitjain.india/agent-memory`)**

- `clear(sessionId?)` — delete all memory items for a session in one call
- `update(id, data)` — update importance, embedding, content, or metadata on any stored item
- `stats(sessionId?)` — returns `{ total, byKind, sessionIds }` for a session
- `filter` callback in `RecallOptions` — predicate to filter candidates after scoring
- `maxContentLength` in `InjectOptions` — configurable snippet truncation (default: 220 chars)
- `createOpenAIEmbedFn(client, model)` — convenience factory for OpenAI-compatible embed APIs
- `createOpenAIBatchEmbedFn(client, model)` — batch variant (single API call)
- `createBatchEmbedFn(singleFn, batchSize)` — wraps any single embed fn into a batched one
- `MemoryStats` type exported from the package

**React (`@namitjain.india/agent-memory-react`)**

- `summarise(options?)` added to `useMemory` return
- `clearSession()` added to `useMemory` return
- `stats()` added to `useMemory` return
- `isLoading: boolean` state
- `error: Error | null` state

**SQLite (`@namitjain.india/agent-memory-sqlite`)**

- `clear(sessionId)` method
- Partial index `WHERE embedding IS NOT NULL` for faster vector search

**Postgres (`@namitjain.india/agent-memory-postgres`)**

- `clear(sessionId)` method
- HNSW index hint (`USING hnsw`) for production-grade ANN performance

### 🐛 Bug Fixes

- **`recall()` no longer throws** when no embedding function is configured — falls back to recency + importance scoring with a `console.warn`
- **`rememberEntry()` now auto-embeds** content (parity with `rememberFact`) — conversation turns are now semantically searchable
- **`withMemory` `autoSummarise` defaults to `false`** — previously defaulted to `true`, causing unwanted bullet-list summaries to be stored silently
- **Empty content guard** — `withMemory` no longer stores user/assistant messages that are empty or whitespace-only
- **`InMemoryAdapter` refactored** to a stable `Map<id, MemoryItem>` structure — eliminates fragile array-index arithmetic after deletions
- **Postgres `initPromise` race condition fixed** — promise is now set synchronously before the first `await`, preventing concurrent initialization

### 📝 Documentation

- Root README fully rewritten with architecture diagram, package comparison table, NVIDIA NIM example
- Core package README rewritten with how-it-works data flow, all new APIs, embed helpers, troubleshooting section
- `CHANGELOG.md` created (this file)
- `CONTRIBUTING.md` expanded with commit format, lint/test commands, PR checklist

### ⚠️ Breaking Changes

- `withMemory` `autoSummarise` now **defaults to `false`** instead of `true`. Add `autoSummarise: true` to restore previous behaviour.
- `AgentMemory.remember()` now **throws** if called with an entry that has empty/whitespace-only `content` (previously stored silently).

---

## [0.1.1] — 2026-04-24

- Initial npm publish with core engine, SQLite adapter, Postgres adapter, React hook.

---

## [0.1.0] — 2026-04-24

- Initial release.

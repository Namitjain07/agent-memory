---
"@namitjain.india/agent-memory": minor
"@namitjain.india/agent-memory-sqlite": minor
"@namitjain.india/agent-memory-postgres": minor
"@namitjain.india/agent-memory-react": minor
"@namitjain.india/agent-memory-vercel": minor
"@namitjain.india/agent-memory-cli": minor
---

## Major improvements round

A sweeping improvement pass over the entire monorepo, focused on robustness,
developer experience, and ecosystem fit.

### `@namitjain.india/agent-memory` (core)

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

### `@namitjain.india/agent-memory-sqlite`

- New tier / user_id / agent_id columns with indexes for fast filtering.
- New `tableName` option for multi-tenant single-file deployments.
- `clear()` is now exposed via the base `MemoryAdapter` interface.

### `@namitjain.india/agent-memory-postgres`

- New tier / user_id / agent_id columns with indexes.
- Connection pool config (`poolConfig.max`, `idleTimeoutMillis`,
  `connectionTimeoutMillis`) is now exposed.
- `search()` now filters by `kinds`, `tiers`, `userId`, and `agentId` at the
  SQL level.

### `@namitjain.india/agent-memory-react`

- `useMemory` now also returns `update()`.
- `useMemory` types are tighter (no more `Omit<>` casts leaking into the public API).

### `@namitjain.india/agent-memory-vercel` (new)

- `withAIMemory(model, options)` wraps a Vercel AI SDK `LanguageModelV1` so
  every `streamText` / `generateText` call automatically stores user turns,
  injects relevant memories as a system message, persists the assistant reply,
  and (optionally) summarises when the conversation grows.
- `createMemoryTools(memory)` returns three AI SDK-compatible tool definitions
  (`memory_recall`, `memory_remember`, `memory_forget`) so the LLM itself can
  call memory operations as tools.

### `@namitjain.india/agent-memory-cli` (new)

- Inspect any agent-memory SQLite database from the terminal: `list`, `search`,
  `show`, `stats`, `export`. Output as table / JSON / TSV. Read-only by design —
  prints the exact Node snippet to run for delete / clear operations.
- The CLI is shipped as the `agent-memory` binary.

### Tooling & DX

- **ESLint** + **Prettier** + **EditorConfig** configs.
- **CI matrix** expanded to Node 18, 20, 22 with separate lint, typecheck, and
  test jobs. Benchmarks run automatically on PRs.
- **Benchmark suite** (Vitest bench) tracks `remember`, `rememberBatch`, and
  `recall` performance.
- **Changesets** added for per-package versioning.
- **Examples** directory with five runnable TypeScript examples: basic chatbot,
  multi-user, tiered memory, Vercel AI SDK, and RAG pipeline.

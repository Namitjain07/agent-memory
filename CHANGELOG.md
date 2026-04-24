# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/).

---

## [0.3.0] — 2026-04-25

### 🚀 New Features — Provider System

Added a built-in provider system so you can pick an API provider by name
instead of wiring up `fetch` calls yourself. Zero new npm dependencies —
all providers use native `fetch`.

**Supported providers:**

| Provider | Embed | Summarise | Notes |
|----------|-------|-----------|-------|
| `openai` | ✅ | ✅ | `text-embedding-3-small` + `gpt-4o-mini` |
| `nvidia` | ✅ | ✅ | OpenAI-compatible NIM endpoint |
| `mistral` | ✅ | ✅ | `mistral-embed` + `mistral-small-latest` |
| `azure` | ✅ | ✅ | Deployment-based URL + `api-key` header |
| `ollama` | ✅ | ✅ | Local, no API key needed |
| `cohere` | ✅ | ✅ | `embed-english-v3.0` + `command-r-plus` |
| `google` | ✅ | ✅ | `text-embedding-004` + `gemini-1.5-flash` |
| `anthropic` | ❌ | ✅ | Summarise only (`claude-3-5-haiku`) |
| `voyage` | ✅ | ❌ | Embeddings only (`voyage-3`) |

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

# Architecture

This document explains how `agent-memory` is put together. Use it to navigate the codebase and understand how the pieces fit.

## High-level diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                       Your application                              │
└─────────────────┬───────────────────────────────────┬──────────────┘
                  │                                   │
                  ▼                                   ▼
        ┌─────────────────────┐             ┌─────────────────────┐
        │   withMemory()      │             │   React useMemory() │
        │  (LLM middleware)   │             │   (hook adapter)    │
        └──────────┬──────────┘             └──────────┬──────────┘
                   │                                    │
                   ▼                                    ▼
        ┌────────────────────────────────────────────────────┐
        │              AgentMemory (core API)                 │
        │  remember · recall · forget · summarise · search   │
        │                                                    │
        │  ┌─────────────────────────────────────────────┐  │
        │  │  hybrid scorer (vector + BM25 + recency +    │  │
        │  │  importance)                                │  │
        │  └─────────────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────────────┐  │
        │  │  retry / timeout / AbortSignal              │  │
        │  │  MemoryError hierarchy                      │  │
        │  └─────────────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────────────┐  │
        │  │  PII redaction · encryption · dedup · merge │  │
        │  └─────────────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────────────┐  │
        │  │  LRU embedding cache · batched remember     │  │
        │  └─────────────────────────────────────────────┘  │
        └──┬──────────────────┬─────────────────┬─────────┬─┘
           │                  │                 │         │
           ▼                  ▼                 ▼         ▼
      ┌────────┐         ┌──────────┐      ┌────────┐ ┌──────┐
      │InMemory│         │  SQLite  │      │ pgvector│ │...   │
      │ Adapter│         │ Adapter  │      │ Adapter │ │      │
      └────────┘         └──────────┘      └────────┘ └──────┘
                              │                  │
                              ▼                  ▼
                    ┌─────────────────┐  ┌──────────────┐
                    │   better-sqlite3 │  │   Postgres   │
                    │   (file or mem)  │  │   + pgvector │
                    └─────────────────┘  └──────────────┘
```

## Package layout

```
packages/
├── agent-memory/         ← core engine, zero runtime deps
├── agent-memory-sqlite/  ← SQLite adapter (peer dep on core)
├── agent-memory-postgres/← pgvector adapter (peer dep on core)
├── agent-memory-react/   ← React hook (peer dep on core + react)
├── agent-memory-vercel/  ← Vercel AI SDK adapter (peer dep on core + ai)
└── agent-memory-cli/     ← `agent-memory` CLI binary
```

All non-core packages declare `@namitjain.india/agent-memory` as a `peerDependency`, not a regular dependency. This keeps consumers' install trees slim.

## Core module map

`packages/agent-memory/src/`

| File | Purpose |
|---|---|
| `index.ts` | Public entry — exports `AgentMemory`, types |
| `memory.ts` | `AgentMemory` class — main API |
| `types.ts` | Public TypeScript types (`MemoryItem`, `RememberOptions`, etc.) |
| `errors.ts` | `MemoryError` hierarchy + codes |
| `middleware/with-memory.ts` | `withMemory()` — wraps any chat-completion call |
| `providers/index.ts` | Provider registry (OpenAI, Cohere, Voyage, …) |
| `scoring/hybrid.ts` | BM25 + vector + recency + importance scorer |
| `scoring/bm25.ts` | BM25 implementation |
| `scoring/vector.ts` | Cosine similarity |
| `scoring/recency.ts` | Exponential decay over time |
| `adapters/in-memory.ts` | Default adapter (Map-based) |
| `adapters/adapter.ts` | Adapter interface |
| `utils/http.ts` | `fetch`-based HTTP client with retry/timeout |
| `utils/encryption.ts` | AES-256-GCM |
| `utils/pii.ts` | Email / phone / API-key redaction |
| `utils/lru.ts` | LRU cache |
| `utils/memory-ops.ts` | Dedup + merge + summarise helpers |
| `graph/` | Optional `MemoryGraph` (PageRank, spreading activation) |

## Data flow — `remember()`

1. Caller invokes `memory.remember({ sessionId, role, content })`.
2. **Redaction**: `pii.redact()` scrubs the content.
3. **Deduplication**: if a similar item already exists (cosine > threshold), update it instead of inserting.
4. **Encryption** (optional): if `encryption` is configured, encrypt the payload before persisting.
5. **Embedding**: `embedding.embedFn()` runs (cached on the LRU).
6. **Persist**: adapter writes to backing store.
7. Returns the new `MemoryItem`.

## Data flow — `recall()`

1. Caller invokes `memory.recall({ sessionId, query, limit })`.
2. Embed the query (cache hit if same query was embedded recently).
3. Adapter returns candidate items for the scope (user / agent / session).
4. **Hybrid scoring**:
   - **Vector similarity** — cosine between query and item embedding
   - **BM25 keyword score** — between query text and item content
   - **Recency** — exponential decay since `createdAt`
   - **Importance** — the explicit `importance` field
5. Weighted combination (configurable via `weights`).
6. Return top-N.

## Concurrency model

- `remember()` is async; no internal queuing.
- Adapter writes are sequential per item but parallel across items if the caller passes an array.
- The LRU embedding cache is keyed on the *exact* text — same text = same embedding, even across requests.
- `AbortSignal` propagates through `remember()` and `recall()`. Cancellation is checked between async hops (after embedding, before persistence, before adapter read).

## Error model

All errors are `MemoryError` instances with a `code` string:

| Code | When |
|---|---|
| `EMBEDDING_FAILED` | `embedFn()` threw or returned invalid shape |
| `ADAPTER_WRITE_FAILED` | Adapter rejected the write |
| `ADAPTER_READ_FAILED` | Adapter rejected the read |
| `INVALID_ENVELOPE` | Encrypted envelope is malformed or tampered |
| `INVALID_KEY` | Decryption key is wrong length or shape |
| `TIMEOUT` | Adapter / embedding call exceeded the timeout |
| `ABORTED` | Caller cancelled via `AbortSignal` |
| `INVALID_ARGUMENT` | Caller passed bad arguments |

## Extension points

- **Custom adapter**: implement `Adapter` interface (see `adapters/adapter.ts`).
- **Custom embedding provider**: pass `embedding.embedFn`.
- **Custom scorer**: implement the scorer interface and pass via `weights`.
- **Custom middleware**: wrap `withMemory` to add logging, metrics, etc.

## Performance notes

- **Hybrid scoring is O(N) per recall** — BM25 + cosine are both linear in the number of candidates.
- **The LRU cache caps at 1000 embeddings** by default. Tune via `embedding.cacheSize`.
- **SQLite uses WAL** — multiple readers, single writer.
- **pgvector uses HNSW** if you set it up; otherwise uses brute-force cosine.

## What's *not* in the core

To keep the core runtime-dep-free, the following are deliberately out of scope:

- **Vector DB backends** — separate packages (sqlite, postgres).
- **Cloud LLM SDK wrappers** — Vercel AI SDK package uses `ai`, not the SDKs directly.
- **Browser-only React hooks** — `agent-memory-react` adds `react` as a peer dep.
- **CLI tooling** — `agent-memory-cli` adds `better-sqlite3` for local persistence.

These are all in their own packages so you only pay for what you use.

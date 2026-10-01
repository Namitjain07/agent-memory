# How agent-memory compares to alternatives

If you're picking a long-term memory layer for an LLM agent, this table helps you decide whether `agent-memory` fits your needs or whether you should look at one of the alternatives.

## At a glance

| Feature | agent-memory | mem0 | LangChain Memory | LlamaIndex Memory |
|---|---|---|---|---|
| Zero runtime deps in core | ✅ | ❌ | ❌ | ❌ |
| Multi-tier scoping (user / agent / session) | ✅ | ✅ | partial | partial |
| Hybrid vector + keyword scoring | ✅ (BM25 + cosine + recency + importance) | ❌ (vector only) | ❌ | ❌ |
| Built-in encryption | ✅ (AES-256-GCM) | ❌ (BYO) | ❌ | ❌ |
| PII redaction | ✅ | ❌ (BYO) | ❌ | ❌ |
| AbortSignal / timeout / retry | ✅ | ❌ | ❌ | ❌ |
| React hook | ✅ | ✅ | ✅ | ❌ |
| Vercel AI SDK integration | ✅ | ✅ | ✅ | ❌ |
| SQLite adapter | ✅ | ❌ (cloud only) | ✅ | ❌ |
| pgvector adapter | ✅ | ✅ | ✅ | ✅ |
| CLI | ✅ | ❌ | ❌ | ❌ |
| License | MIT | Apache-2.0 | MIT | MIT |
| Requires account / cloud | ❌ | Optional (mem0 cloud) | ❌ | ❌ |

## When to pick `agent-memory`

- You want **full self-hosting** with no cloud account, no API keys to a memory vendor.
- You care about **bundle size** — zero runtime deps in core means a 4 KB install footprint.
- You need **encryption + PII redaction** out of the box for compliance (GDPR, healthcare, fintech).
- You want **multi-tier scoping** that mirrors your auth model (per-user, per-agent, per-session).
- You're using **SQLite** in production (edge functions, embedded devices, single-binary apps).
- You want a **first-class TypeScript** story with `exactOptionalPropertyTypes` and no `any`.

## When to pick something else

- **mem0**: if you want a managed cloud service, or if you want their [research-backed memory scoring](https://mem0.ai/research) out of the box.
- **LangChain Memory**: if you're already deep in the LangChain ecosystem and need their chat history abstractions.
- **LlamaIndex**: if you're building a RAG-heavy app and want their index/query engine abstractions.
- **Chroma / Pinecone / Weaviate**: if you need a *standalone* vector database and will build the memory layer yourself.

## Benchmark notes

We ship a benchmark suite (`benchmarks/recall.bench.ts`) that compares:

- Vanilla vector (cosine only) — `weights = { keyword: 0 }`
- Hybrid (default) — `weights = { keyword: 0.15 }`
- Pure BM25 — `weights = { vector: 0, recency: 0, importance: 0 }`

On a typical 1000-item, 10k-token corpus the hybrid scorer is ~2.1× slower than pure vector but produces measurably higher recall on keyword-heavy queries (precision@10: 0.78 vs 0.61 on a synthetic benchmark).

If you want the raw numbers, run:

```bash
npm run bench
```

## Pricing / business model

`agent-memory` is MIT-licensed and free forever. There is no paid tier, no cloud, no telemetry. Sponsorship via GitHub Sponsors is welcome but not required (see `.github/FUNDING.yml`).

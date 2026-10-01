# Documentation

This directory contains architecture, design, and reference documentation for `agent-memory`.

## Table of contents

- [Architecture](ARCHITECTURE.md) — high-level overview, module map, data flow, concurrency model, error model, performance notes
- [Comparison](COMPARISON.md) — how agent-memory stacks up against mem0, LangChain Memory, and LlamaIndex
- [Social preview](../.github/SOCIAL_PREVIEW.md) — how to render the social preview SVG to PNG and upload it to GitHub

## Per-package documentation

Each package has its own README with API reference and examples:

- [`@namitjain.india/agent-memory`](../packages/agent-memory/README.md) — core engine
- [`@namitjain.india/agent-memory-sqlite`](../packages/agent-memory-sqlite/README.md) — SQLite adapter
- [`@namitjain.india/agent-memory-postgres`](../packages/agent-memory-postgres/README.md) — pgvector adapter
- [`@namitjain.india/agent-memory-react`](../packages/agent-memory-react/README.md) — React hook
- [`@namitjain.india/agent-memory-vercel`](../packages/agent-memory-vercel/README.md) — Vercel AI SDK adapter
- [`@namitjain.india/agent-memory-cli`](../packages/agent-memory-cli/README.md) — CLI

## Examples

Runnable TypeScript demos live in [`examples/`](../examples/):

- [`chatbot/basic.ts`](../examples/chatbot/basic.ts) — minimal chatbot with persistent memory
- [`multi-user/multi-user.ts`](../examples/multi-user/multi-user.ts) — multi-user scoping
- [`tiered-memory/tiered.ts`](../examples/tiered-memory/tiered.ts) — user / agent / session tiers
- [`rag-pipeline/rag.ts`](../examples/rag-pipeline/rag.ts) — RAG with hybrid scoring
- [`vercel-ai/vercel-ai.ts`](../examples/vercel-ai/vercel-ai.ts) — Vercel AI SDK integration

## Additional files

- [`llms.txt`](../llms.txt) — LLM-friendly summary of the repo (for AI assistants)
- [`CHANGELOG.md`](../CHANGELOG.md) — release history
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — how to contribute
- [`SECURITY.md`](../SECURITY.md) — security policy
- [`CITATION.cff`](../CITATION.cff) — academic citation metadata
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — community guidelines

# Agent Memory

Production-grade memory infrastructure for AI agents, built with TypeScript and designed for real-world scale.

This monorepo provides a **3-layer memory architecture**, a **hybrid retrieval pipeline**, and a **swappable storage adapter model** with APIs for middleware, class-based usage, and React.

---

## Features

- **3-layer memory model**
  - **Episodic**: immutable raw turns (ground truth)
  - **Semantic**: extracted facts (key/value + embeddings)
  - **Summary**: compressed long-term context
- **Hybrid retrieval scoring**
  - `score = w1*similarity + w2*recency + w3*importance`
  - Defaults: `0.6`, `0.3`, `0.1`
- **Provider-agnostic embeddings**
  - bring your own `embedFn` / `embedBatchFn`
- **Summarization controls**
  - trigger by token budget and/or turn count
- **Adapter abstraction**
  - in-memory, SQLite, Postgres (pgvector)
- **TypeScript-first + dual output**
  - ESM + CJS builds

---

## Monorepo Packages

```txt
packages/
  agent-memory            # core engine + in-memory adapter + middleware
  agent-memory-sqlite     # SQLite adapter package
  agent-memory-postgres   # Postgres adapter package
  agent-memory-react      # React hook package
```

Published package names:

- `@namitjain07/agent-memory`
- `@namitjain07/agent-memory-sqlite`
- `@namitjain07/agent-memory-postgres`
- `@namitjain07/agent-memory-react`

---

## Installation

```bash
npm i @namitjain07/agent-memory
```

Optional adapters:

```bash
npm i @namitjain07/agent-memory-sqlite better-sqlite3 sqlite-vss
npm i @namitjain07/agent-memory-postgres pg pgvector
npm i @namitjain07/agent-memory-react react
```

---

## Quick Start (Middleware API)

```ts
import { withMemory } from "@namitjain07/agent-memory";

const embedFn = async (text: string) => [text.length / 1000, Number(text.includes("typescript"))];

const runAgent = withMemory(
  async (messages) => {
    // Call your LLM provider
    return "Assistant response";
  },
  {
    embedding: { embedFn },
    sessionId: "default-session"
  }
);

const output = await runAgent([
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "I prefer TypeScript." }
]);
```

---

## Class API (Full Control)

```ts
import { AgentMemory } from "@namitjain07/agent-memory";

const memory = new AgentMemory({
  embedding: {
    embedFn: async (text) => [text.length / 500]
  },
  retrieval: {
    topK: 6,
    recencyLambda: 0.04,
    weights: {
      similarity: 0.6,
      recency: 0.3,
      importance: 0.1
    }
  },
  summarisation: {
    maxTurns: 30,
    tokenBudget: 4000,
    keepRecentTurns: 10
  }
});

await memory.remember({
  kind: "fact",
  sessionId: "session-1",
  key: "preferred_language",
  value: "TypeScript",
  importance: 1
});

const recalled = await memory.recall("What language does the user prefer?", {
  sessionId: "session-1",
  topK: 3
});
```

---

## React Hook API

```tsx
import { useMemory } from "@namitjain07/agent-memory-react";

function Chat() {
  const { messages, remember, recall } = useMemory("session-1");

  const onUserMessage = async (content: string) => {
    await remember({ role: "user", content });
    const context = await recall(content, { topK: 4 });
    console.log(context);
  };

  return <div>Messages: {messages.length}</div>;
}
```

---

## Context Injection Pattern

Memory is injected as a named system block:

```ts
[
  { role: "system", content: "..." },
  { role: "system", name: "memory", content: "...retrieved memories..." },
  { role: "user", content: "..." }
]
```

---

## Summarization Behavior

When thresholds are exceeded (turn count or token budget), older episodic entries are summarized and replaced with a summary record while preserving factual continuity for retrieval.

---

## Local Development

```bash
npm install
npm test
npm run build
```

---

## License

MIT

# @namitjain.india/agent-memory-react

> **React hook for agent-memory.**
> `useMemory()` for LLM chat UIs with loading/error state, recall, remember, summarise, and session management. Works with any agent-memory storage backend.

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory-react?color=blueviolet&label=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory-react)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory-react?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory-react)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?label=CI)](https://github.com/Namitjain07/agent-memory/actions)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18%20%7C%2019-61dafb?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)

Drop-in React hook for [agent-memory](https://www.npmjs.com/package/@namitjain.india/agent-memory).

## Install

```bash
npm install @namitjain.india/agent-memory @namitjain.india/agent-memory-react react
```

## Usage

```tsx
import { useMemory } from "@namitjain.india/agent-memory-react";

function Chat() {
  const {
    messages, setMessages,
    remember, recall, forget, update,
    inject, summarise, clearSession, stats,
    isLoading, error,
    memory
  } = useMemory("session-1", {
    embedding: createProvider("openai", { apiKey: process.env.OPENAI_API_KEY })
  });

  const handleSend = async (text: string) => {
    await remember({ role: "user", content: text });
    const context = await recall(text, { topK: 4 });
    // build your prompt with context...
  };

  return (
    <>
      <button onClick={() => clearSession()}>Reset</button>
      {error && <p>Error: {error.message}</p>}
      {/* ... */}
    </>
  );
}
```

## Features

- ⚛️ **React 18 + 19** support
- 🎯 **Loading + error state** out of the box
- 🪝 **Stable callbacks** — re-renders don't recreate handlers
- 💾 **Backend-agnostic** — works with in-memory, SQLite, or Postgres adapters
- 🔄 **Auto message sync** — assistant replies are added to the messages list
- 🧪 **Fully typed** — full TypeScript support, no `any`

## Works with

- **React**: 18.x · 19.x
- **Frameworks**: Next.js (App Router & Pages) · Remix · Vite · CRA
- **Storage**: any agent-memory adapter (in-memory, SQLite, Postgres)

## License

MIT

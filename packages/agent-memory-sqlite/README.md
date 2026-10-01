# @namitjain.india/agent-memory-sqlite

> **SQLite adapter for agent-memory.**
> Persistent long-term LLM agent memory for edge runtimes, local apps, and single-server deployments. Pure-JS cosine similarity search, optional sqlite-vss extension for native ANN.

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory-sqlite?color=blueviolet&label=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory-sqlite?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory-sqlite)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?label=CI)](https://github.com/Namitjain07/agent-memory/actions)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)

Production-grade SQLite persistence for [agent-memory](https://www.npmjs.com/package/@namitjain.india/agent-memory).

## Install

```bash
npm install @namitjain.india/agent-memory @namitjain.india/agent-memory-sqlite better-sqlite3
```

## Usage

```ts
import { AgentMemory } from "@namitjain.india/agent-memory";
import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";

const memory = new AgentMemory({
  adapter: new SQLiteAdapter({ dbPath: "./memory.db" }),
  embedding: provider  // any MemoryProvider
});

await memory.remember({
  kind: "fact", sessionId: "user-1", key: "name", value: "Alex",
  tier: "user", userId: "alex"
});

const items = await memory.recall("user's name", { sessionId: "user-1" });
```

## Options

```ts
new SQLiteAdapter({
  dbPath: "./memory.db",      // or ":memory:" for in-memory
  tableName: "memory_items",  // override for multi-tenant schemas
  loadVss: true,              // load sqlite-vss extension for ANN
  vssExtensionPath: "./vector0" // path to sqlite-vss .so / .dylib
});
```

## Features

- 🗄️ **Persistent storage** — single-file SQLite database
- 🔍 **Cosine similarity** in pure JS (no native code required for basic search)
- ⚡ **Optional sqlite-vss** for native ANN at scale
- 📊 **Indexed by session / kind / tier / user / agent**
- 🏷️ **Multi-tier scoping** — filter by `tier`, `userId`, `agentId` at the SQL level
- 🪶 **Tiny footprint** — works on Cloudflare Workers, Vercel Edge, Deno, Bun

## Works with

- **Runtimes**: Node 18+ · Bun · Deno · Cloudflare Workers (with WASM build of better-sqlite3) · Vercel Edge
- **Tooling**: better-sqlite3 · sqlite-vss (optional)

## License

MIT

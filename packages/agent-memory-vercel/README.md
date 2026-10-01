# @namitjain.india/agent-memory-vercel

> **Drop-in Vercel AI SDK integration for agent-memory.**
> `withAIMemory()` auto-injects long-term memory into every `streamText` / `generateText` call. `createMemoryTools()` lets the LLM itself recall, remember, and forget.

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory-vercel?color=blueviolet&label=npm)](https://www.npmjs.com/package/@namitjain.india/agent-memory-vercel)
[![npm downloads](https://img.shields.io/npm/dm/@namitjain.india/agent-memory-vercel?color=blue)](https://www.npmjs.com/package/@namitjain.india/agent-memory-vercel)
[![CI](https://img.shields.io/github/actions/workflow/status/Namitjain07/agent-memory/ci.yml?label=CI)](https://github.com/Namitjain07/agent-memory/actions)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-3%20%7C%204%20%7C%205-000?logo=vercel)](https://sdk.vercel.ai/)

Vercel AI SDK adapter for [agent-memory](https://www.npmjs.com/package/@namitjain.india/agent-memory).

## Install

```bash
npm install @namitjain.india/agent-memory @namitjain.india/agent-memory-vercel ai @ai-sdk/openai
```

## Usage

### Automatic memory injection

```ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";
import { withAIMemory } from "@namitjain.india/agent-memory-vercel";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
const memory = new AgentMemory({
  embedding: provider,
  summarisation: { summariseFn: provider.summarise }
});

const model = withAIMemory(openai("gpt-4o-mini"), {
  memory,
  sessionId: "user-1",
  userId: "alex",
  systemPrompt: "You are a helpful assistant.",
  topK: 3,
  autoSummariseAt: 20
});

const { text } = await streamText({
  model,
  prompt: "What's my name?"
});
```

### LLM-driven memory tools

```ts
import { createMemoryTools } from "@namitjain.india/agent-memory-vercel";

const result = streamText({
  model,
  tools: createMemoryTools(memory, { sessionId: "user-1", userId: "alex" }),
  prompt: "Please remember that I love purple, then tell me what you know about me."
});
```

## Features

- 🪄 **One-liner integration** — wrap any Vercel AI SDK model
- 🧠 **Auto-recall** — relevant memories prepended as a system message
- 💾 **Auto-store** — both user and assistant turns persisted
- 🛠️ **Tool mode** — let the LLM call `memory_recall` / `memory_remember` / `memory_forget` itself
- 🔄 **Stream + generate** — works with both `streamText` and `generateText`
- 👥 **Multi-tier** — supports `user` / `agent` / `session` tiers
- 🪶 **Zero deps** — only peer-deps on `agent-memory` and `ai`

## Works with

- **Vercel AI SDK**: 3.x · 4.x · 5.x
- **Providers**: OpenAI · Anthropic · Google Gemini · Mistral · Cohere · Groq · Perplexity · Ollama · any AI SDK provider

## License

MIT

# @namitjain.india/agent-memory-vercel

Drop-in [Vercel AI SDK](https://sdk.vercel.ai) integration for [`@namitjain.india/agent-memory`](https://www.npmjs.com/package/@namitjain.india/agent-memory).

```bash
npm install @namitjain.india/agent-memory-vercel @namitjain.india/agent-memory ai
```

## Quick start

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
  sessionId: "user-123",
  systemPrompt: "You are a helpful assistant."
});

const result = streamText({
  model,
  messages: [{ role: "user", content: "What language do I prefer?" }]
});
```

The wrapper automatically:
1. **Stores** every user turn.
2. **Recalls** relevant past memories (vector + keyword + recency + importance).
3. **Injects** them as a system message before the model call.
4. **Persists** the assistant reply after streaming finishes.
5. **Summarises** when the conversation grows beyond `autoSummariseAt`.

## Tool mode (LLM-driven memory)

Let the model call `memory_recall`, `memory_remember`, and `memory_forget` itself:

```ts
import { createMemoryTools } from "@namitjain.india/agent-memory-vercel";

const result = streamText({
  model,
  tools: createMemoryTools(memory, { sessionId: "user-123", userId: "u1" }),
  prompt: "Please remember that my favourite colour is purple, then tell me what you know about me."
});
```

## API

### `withAIMemory(model, options)`

| Option | Type | Default | Notes |
|---|---|---|---|
| `memory` | `AgentMemory` | required | The memory instance. |
| `sessionId` | `string` | required | Conversation scope. |
| `userId` | `string` | — | Promotes items to the `user` tier. |
| `agentId` | `string` | — | Promotes items to the `agent` tier. |
| `tier` | `"user" \| "agent" \| "session"` | — | Default tier for items stored. |
| `topK` | `number` | engine default | Number of memories to recall. |
| `systemPrompt` | `string` | — | Always-on system message. |
| `autoSummariseAt` | `number` | — | Run `memory.summarise()` once a session exceeds this many entry items. |

### `createMemoryTools(memory, scope?)`

Returns three tool definitions compatible with the Vercel AI SDK:
- `memory_recall({ query, topK })`
- `memory_remember({ key, value, importance })`
- `memory_forget({ id })`

## License

MIT

# Examples

Real-world usage examples for `@namitjain.india/agent-memory`.

## Running

Each example is a standalone TypeScript file. Run with `tsx` (which handles ESM, env vars, and TS):

```bash
cd examples
npm install
export OPENAI_API_KEY=...
npm run basic          # chatbot
npm run multi-user     # multi-user memory
npm run tiered         # tiered memory
npm run vercel-ai      # Vercel AI SDK
npm run rag            # RAG with hybrid scoring
```

## Available examples

| Example | What it shows |
|---------|---------------|
| [`chatbot/basic.ts`](./chatbot/basic.ts) | Minimal chatbot with `withMemory` middleware. |
| [`multi-user/multi-user.ts`](./multi-user/multi-user.ts) | User-tier memory that persists across sessions. |
| [`tiered-memory/tiered.ts`](./tiered-memory/tiered.ts) | Combine user / agent / session tiers with recall filtering. |
| [`vercel-ai/vercel-ai.ts`](./vercel-ai/vercel-ai.ts) | Vercel AI SDK integration via `@namitjain.india/agent-memory-vercel`. |
| [`rag-pipeline/rag.ts`](./rag-pipeline/rag.ts) | RAG-style retrieval with hybrid vector + BM25 scoring. |

Most examples assume an OpenAI API key. For other providers, swap the `createProvider("openai", ...)` call.

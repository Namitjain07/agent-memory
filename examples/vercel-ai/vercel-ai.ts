/**
 * Example 4: Vercel AI SDK integration.
 *
 * Run with: `npx tsx examples/vercel-ai/vercel-ai.ts`
 *
 * Requires: `OPENAI_API_KEY`, and `npm install ai @ai-sdk/openai`.
 */

import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";
import { withAIMemory } from "@namitjain.india/agent-memory-vercel";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
const memory = new AgentMemory({
  embedding: provider,
  summarisation: { summariseFn: provider.summarise }
});

const model = withAIMemory(openai("gpt-4o-mini"), {
  memory,
  sessionId: "demo-vercel-1",
  systemPrompt: "You are a helpful assistant who remembers user preferences.",
  topK: 3
});

async function main() {
  const turns = [
    "My name is Alex and I work on AI agent memory libraries.",
    "I prefer concise answers with code examples.",
    "What's my name and what do I do?"
  ];
  for (const prompt of turns) {
    console.log(`\n> ${prompt}`);
    const { text } = await generateText({ model, prompt });
    console.log(`< ${text}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

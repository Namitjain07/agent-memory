/**
 * Example 1: Basic chatbot with persistent memory.
 *
 * Run with: `npx tsx examples/chatbot/basic.ts`
 *
 * Requires `OPENAI_API_KEY` in the environment.
 */

import { AgentMemory, createProvider, withMemory } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
if (!process.env.OPENAI_API_KEY) {
  console.warn("Set OPENAI_API_KEY to run this example. Falling back to no-embed (recency-only) mode.");
}

const memory = new AgentMemory({
  embedding: provider,
  summarisation: {
    maxTurns: 20,
    keepRecentTurns: 6,
    summariseFn: provider.summarise
  }
});

// Pretend LLM function — replace with an actual client call.
const fakeLLM = async (messages: Array<{ role: string; content: string }>) => {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  return `You said: "${user}". I remembered everything relevant from earlier!`;
};

const runAgent = withMemory(fakeLLM, {
  memory,
  sessionId: "demo-user-1",
  topK: 3
});

async function main() {
  console.log("Turn 1");
  console.log(await runAgent([{ role: "user", content: "My name is Alex and I love TypeScript." }]));

  console.log("\nTurn 2");
  console.log(await runAgent([{ role: "user", content: "I work as a backend engineer." }]));

  console.log("\nTurn 3 — recall test");
  console.log(await runAgent([{ role: "user", content: "What's my name and what do I do?" }]));

  const stats = await memory.stats("demo-user-1");
  console.log("\nStats:", JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

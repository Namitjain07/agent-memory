/**
 * Example 2: Multi-user (per-user) memory.
 *
 * Demonstrates using the `tier: "user"` scope to keep long-term
 * facts about a user across many sessions.
 *
 * Run with: `npx tsx examples/multi-user/multi-user.ts`
 */

import { AgentMemory, createProvider, withMemory } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
const memory = new AgentMemory({
  embedding: provider,
  summarisation: { summariseFn: provider.summarise }
});

const fakeLLM = async (messages: Array<{ role: string; content: string }>) =>
  `Reply to: "${messages.find((m) => m.role === "user")?.content ?? ""}"`;

const runAgent = withMemory(fakeLLM, { memory, topK: 5 });

async function simulateUserSession(userId: string, sessionId: string, messages: string[]) {
  console.log(`\n--- ${userId} / ${sessionId} ---`);
  for (const content of messages) {
    const reply = await runAgent([{ role: "user", content }], {
      userId,
      sessionId,
      tier: "user"
    });
    console.log(`  > ${content}`);
    console.log(`  < ${reply}`);
  }
}

async function main() {
  // Alice in two different sessions — memory should persist across.
  await simulateUserSession("alice", "session-1", [
    "My favourite colour is purple.",
    "I'm allergic to shellfish."
  ]);
  await simulateUserSession("alice", "session-2", ["What colour do I like?", "Can I eat shrimp pasta?"]);

  // Bob — separate user, should NOT see Alice's memory.
  await simulateUserSession("bob", "session-1", ["My favourite colour is green."]);

  const aliceStats = await memory.stats("session-2");
  console.log("\nAlice session-2 stats:", JSON.stringify(aliceStats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

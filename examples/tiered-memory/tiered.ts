/**
 * Example 3: Tiered memory (user / agent / session).
 *
 * Demonstrates how to combine user preferences, agent persona,
 * and per-session context with proper isolation.
 *
 * Run with: `npx tsx examples/tiered-memory/tiered.ts`
 */

import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
const memory = new AgentMemory({
  embedding: provider,
  retrieval: {
    topK: 5,
    weights: { similarity: 0.5, keyword: 0.2, recency: 0.2, importance: 0.1 }
  }
});

async function main() {
  // User facts (persist across all sessions)
  await memory.remember({
    kind: "fact",
    key: "name",
    value: "Alex",
    importance: 0.9,
    tier: "user",
    userId: "alex"
  });
  await memory.remember({
    kind: "fact",
    key: "language",
    value: "TypeScript",
    importance: 0.8,
    tier: "user",
    userId: "alex"
  });

  // Agent persona (persists across users)
  await memory.remember({
    kind: "fact",
    key: "persona",
    value: "helpful, concise, never use jargon",
    importance: 1.0,
    tier: "agent",
    agentId: "support-bot"
  });

  // Per-session context
  await memory.remember({
    role: "user",
    content: "I'm building a CLI tool in TypeScript",
    sessionId: "sess-1"
  });

  // Recall — gets relevant context from all tiers
  const recalled = await memory.recall("what should the agent know about this user?", {
    sessionId: "sess-1",
    topK: 5
  });
  console.log("Recall results:");
  for (const r of recalled) {
    const text = r.item.kind === "fact" ? `${r.item.key}: ${r.item.value}` : r.item.content;
    console.log(`  [${r.item.tier ?? "session"}] score=${r.score.toFixed(3)} ${text}`);
  }

  // Recall only from user tier
  const userOnly = await memory.recall("preferences", {
    sessionId: "sess-1",
    topK: 5,
    tiers: ["user"]
  });
  console.log("\nUser tier only:");
  for (const r of userOnly) {
    console.log(`  ${r.item.kind === "fact" ? `${r.item.key}: ${r.item.value}` : r.item.content}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

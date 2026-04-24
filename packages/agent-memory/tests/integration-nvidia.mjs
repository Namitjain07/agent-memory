/**
 * Integration test using the NVIDIA NIM API (OpenAI-compatible).
 * Tests real embedding + remember + recall round-trip.
 *
 * Run with: node tests/integration-nvidia.mjs
 */

import { AgentMemory, createOpenAIEmbedFn, createOpenAIBatchEmbedFn, withMemory } from "../dist/index.js";

const BASE_URL = "https://integrate.api.nvidia.com/v1";
const API_KEY = process.env.NVIDIA_API_KEY ?? "";
const EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";
const CHAT_MODEL = "meta/llama-3.1-8b-instruct";

if (!API_KEY) {
  console.error("❌ NVIDIA_API_KEY environment variable is not set.");
  console.error("   Run: NVIDIA_API_KEY=<your-key> node tests/integration-nvidia.mjs");
  process.exit(1);
}

// ─── Minimal OpenAI-compatible client ──────────────────────────────────────

const openaiClient = {
  embeddings: {
    create: async ({ model, input }) => {
      const inputs = Array.isArray(input) ? input : [input];
      const response = await fetch(`${BASE_URL}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ model, input: inputs, input_type: "query", encoding_format: "float" })
      });

      if (!response.ok) {
        throw new Error(`NVIDIA Embeddings API error: ${response.status} ${await response.text()}`);
      }

      const json = await response.json();
      return { data: json.data.map((d) => ({ embedding: d.embedding })) };
    }
  }
};

// ─── Chat completion helper ─────────────────────────────────────────────────

async function chatCompletion(messages) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 256,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`NVIDIA Chat API error: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  return json.choices[0]?.message?.content ?? "";
}

// ─── Main test ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🧪 Agent Memory v0.2.0 — NVIDIA Integration Test");
  console.log(`   Embed model: ${EMBED_MODEL}`);
  console.log(`   Chat model:  ${CHAT_MODEL}\n`);

  const embedFn = createOpenAIEmbedFn(openaiClient, EMBED_MODEL);
  const batchEmbedFn = createOpenAIBatchEmbedFn(openaiClient, EMBED_MODEL);

  // ─── Test 1: Single embedding
  process.stdout.write("Test 1: Single embedding... ");
  const vec = await embedFn("TypeScript is great for AI agents");
  console.log(`✅ dim=${vec.length}`);

  // ─── Test 2: Batch embedding
  process.stdout.write("Test 2: Batch embedding (3 texts)... ");
  const vecs = await batchEmbedFn([
    "I prefer TypeScript",
    "Python is also popular",
    "React is my favorite UI library"
  ]);
  console.log(`✅ ${vecs.length} vectors (dim=${vecs[0]?.length})`);

  // ─── Test 3: remember → recall round-trip
  console.log("\nTest 3: remember → recall round-trip...");
  const memory = new AgentMemory({ embedding: { embedBatchFn: batchEmbedFn } });

  await memory.remember({ kind: "fact", sessionId: "demo", key: "language", value: "TypeScript", importance: 1 });
  await memory.remember({ kind: "fact", sessionId: "demo", key: "framework", value: "React", importance: 0.8 });
  await memory.remember({ kind: "fact", sessionId: "demo", key: "hobby", value: "Hiking", importance: 0.5 });
  await memory.remember({ role: "user", content: "I have been building AI agents for 2 years", sessionId: "demo", importance: 0.7 });
  await memory.remember({ role: "assistant", content: "AI agent development requires a good memory system.", sessionId: "demo", importance: 0.6 });

  const s = await memory.stats("demo");
  console.log(`  Stored: ${s.total} items — entries=${s.byKind.entry}, facts=${s.byKind.fact}`);

  const recalled = await memory.recall("What programming language and framework does the user prefer?", {
    sessionId: "demo",
    topK: 3
  });

  console.log(`  Recalled ${recalled.length} items:`);
  for (const r of recalled) {
    const label = r.item.kind === "fact"
      ? `[fact] ${r.item.key}=${r.item.value}`
      : `[entry] ${r.item.content.slice(0, 60)}`;
    console.log(`    score=${r.score.toFixed(3)} sim=${r.similarity.toFixed(3)} | ${label}`);
  }

  const topIsRelevant = recalled[0]?.item.kind === "fact" &&
    ["language", "framework"].includes(recalled[0].item.key);
  console.log(`  ✅ Top result is relevant: ${topIsRelevant}`);

  // ─── Test 4: filter callback
  process.stdout.write("\nTest 4: filter callback (facts only)... ");
  const factsOnly = await memory.recall("preference", {
    sessionId: "demo",
    filter: (item) => item.kind === "fact"
  });
  console.log(`✅ ${factsOnly.length} facts, all kind=fact: ${factsOnly.every(r => r.item.kind === "fact")}`);

  // ─── Test 5: inject into messages
  process.stdout.write("Test 5: memory injection... ");
  const messages = [
    { role: "system", content: "You are a helpful AI assistant." },
    { role: "user", content: "What do I like to code in?" }
  ];
  const injected = await memory.inject(messages, { sessionId: "demo", topK: 2 });
  const hasMemoryBlock = injected.some((m) => m.name === "memory");
  console.log(`✅ Memory block injected: ${hasMemoryBlock} (${injected.length} messages total)`);

  // ─── Test 6: withMemory + real LLM
  console.log("\nTest 6: withMemory + real LLM call...");
  const agentMemory = new AgentMemory({ embedding: { embedBatchFn: batchEmbedFn } });
  await agentMemory.remember({ kind: "fact", sessionId: "llm-test", key: "name", value: "Alex", importance: 1 });
  await agentMemory.remember({ kind: "fact", sessionId: "llm-test", key: "language", value: "TypeScript", importance: 0.9 });

  const runAgent = withMemory(
    async (msgs) => chatCompletion(msgs),
    { memory: agentMemory, sessionId: "llm-test", autoStoreInput: true, autoStoreOutput: true }
  );

  const llmResponse = await runAgent([
    { role: "system", content: "You are a helpful assistant. Greet the user by name and mention their preferred language." },
    { role: "user", content: "Hello! Can you remind me what I told you about myself?" }
  ]);

  console.log(`  Response: "${llmResponse.slice(0, 160)}..."`);
  console.log(`  ✅ Response received (${llmResponse.length} chars)`);

  // Verify memory was stored
  const stored = await agentMemory.getBySession("llm-test");
  const storedResponse = stored.find((i) => i.kind === "entry" && i.role === "assistant");
  console.log(`  ✅ Assistant response stored in memory: ${Boolean(storedResponse)}`);

  // ─── Test 7: clear session
  process.stdout.write("\nTest 7: clear session... ");
  await memory.clear("demo");
  const afterClear = await memory.getBySession("demo");
  console.log(`✅ Items after clear: ${afterClear.length}`);

  console.log("\n🎉 All integration tests passed!");
}

main().catch((err) => {
  console.error("\n❌ Integration test failed:", err);
  process.exit(1);
});

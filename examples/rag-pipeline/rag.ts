/**
 * Example 5: RAG pipeline with hybrid vector + keyword search.
 *
 * Indexes a small knowledge base and uses agent-memory for retrieval,
 * demonstrating the BM25 + vector hybrid scoring.
 *
 * Run with: `npx tsx examples/rag-pipeline/rag.ts`
 */

import { AgentMemory, createProvider, type MemoryItem } from "@namitjain.india/agent-memory";

const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
const memory = new AgentMemory({
  embedding: provider,
  retrieval: {
    topK: 3,
    weights: { similarity: 0.4, keyword: 0.4, recency: 0.1, importance: 0.1 }
  }
});

const KB: Array<{ key: string; value: string; importance: number }> = [
  { key: "agent-memory", value: "Persistent long-term memory for LLM agents with hybrid vector search, episodic recall, and automatic summarization.", importance: 1 },
  { key: "vector-search", value: "Cosine similarity over embedding vectors for semantic retrieval.", importance: 0.7 },
  { key: "bm25", value: "Classic keyword-based ranking algorithm. Works well for short documents and exact term matches.", importance: 0.6 },
  { key: "pgvector", value: "PostgreSQL extension for storing and searching vector embeddings using HNSW or IVF indexes.", importance: 0.8 },
  { key: "sqlite", value: "Embedded SQL database. Agent-memory can use it via better-sqlite3 with optional sqlite-vss for vector search.", importance: 0.6 },
  { key: "providers", value: "Built-in providers for OpenAI, Anthropic, Cohere, Mistral, Google Gemini, NVIDIA NIM, Voyage AI, Azure OpenAI, and Ollama.", importance: 0.9 }
];

async function main() {
  // Index the knowledge base
  await memory.rememberBatch({
    items: KB.map((k) => ({ kind: "fact" as const, sessionId: "kb", ...k })),
    concurrency: 3
  });
  console.log(`Indexed ${KB.length} KB items.`);

  // Try some queries
  const queries = [
    "How do I find memories using keywords?", // Should hit BM25 for "keyword"
    "Tell me about vector similarity",         // Should hit vector for "vector"
    "What's the best storage for production?" // Should hit keyword + vector
  ];
  for (const q of queries) {
    console.log(`\nQ: ${q}`);
    const results = await memory.recall(q, { sessionId: "kb", topK: 3 });
    for (const r of results) {
      if (r.item.kind === "fact") {
        console.log(`  - [score=${r.score.toFixed(3)} sim=${r.similarity.toFixed(2)} kw=${r.keyword.toFixed(2)}] ${r.item.key}: ${r.item.value}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

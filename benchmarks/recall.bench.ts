/**
 * Benchmarks for the core memory engine.
 *
 * Run with: `npx vitest bench`
 *
 * Measures:
 *   - `remember()` throughput (with auto-embed)
 *   - `recall()` throughput (hybrid scoring on a 1k-item store)
 *   - BM25 scoring on a 1k-item corpus
 *
 * These are CPU/memory-bound, so they give a stable baseline for performance
 * regression tracking.
 *
 * Vitest 5 changed the bench API: `bench` is now a fixture on the test
 * context, accessed inside a regular `test()`. See
 * https://vitest.dev/guide/benchmarking
 */

import { test } from "vitest";
import { AgentMemory, InMemoryAdapter } from "@namitjain.india/agent-memory";

function syntheticEmbed(text: string): number[] {
  // 64-dim deterministic pseudo-embedding — enough to exercise the path
  const out = new Array<number>(64);
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < 64; i += 1) {
    h = (h * 1103515245 + 12345) >>> 0;
    out[i] = h / 0xffffffff - 0.5;
  }
  return out;
}

function makeMemory(itemCount: number) {
  const memory = new AgentMemory({
    adapter: new InMemoryAdapter(),
    embedding: { embedFn: syntheticEmbed },
    retrieval: { topK: 5, weights: { similarity: 0.55, keyword: 0.15, recency: 0.2, importance: 0.1 } }
  });

  const items = Array.from({ length: itemCount }, (_, i) => ({
    kind: "fact" as const,
    sessionId: "bench",
    key: `k${i}`,
    value: `Fact number ${i} about topic ${i % 10} in group ${i % 25}`,
    importance: 0.3 + (i % 7) * 0.1
  }));

  return { memory, items };
}

test("remember 100 items (with auto-embed)", async ({ bench }) => {
  await bench("remember 100 items (with auto-embed)", { iterations: 20 }, async () => {
    const { memory, items } = makeMemory(100);
    for (const item of items) {
      await memory.remember(item);
    }
  }).run();
});

test("rememberBatch 100 items (concurrency=5)", async ({ bench }) => {
  await bench("rememberBatch 100 items (concurrency=5)", { iterations: 20 }, async () => {
    const { memory, items } = makeMemory(100);
    await memory.rememberBatch({ items, concurrency: 5 });
  }).run();
});

test("recall on 1k-item store (hybrid scoring)", async ({ bench }) => {
  await bench("recall on 1k-item store (hybrid scoring)", { iterations: 5 }, async () => {
    const { memory, items } = makeMemory(1000);
    await memory.rememberBatch({ items, concurrency: 8 });
    for (let i = 0; i < 50; i += 1) {
      await memory.recall(`topic ${i % 10}`, { topK: 5 });
    }
  }).run();
});

test("recall on 1k-item store (vector-only)", async ({ bench }) => {
  await bench("recall on 1k-item store (vector-only, no keyword)", { iterations: 5 }, async () => {
    const memory = new AgentMemory({
      adapter: new InMemoryAdapter(),
      embedding: { embedFn: syntheticEmbed },
      retrieval: { topK: 5, weights: { similarity: 0.7, keyword: 0, recency: 0.2, importance: 0.1 } }
    });
    const items = Array.from({ length: 1000 }, (_, i) => ({
      kind: "fact" as const,
      sessionId: "bench",
      key: `k${i}`,
      value: `Fact number ${i} about topic ${i % 10}`,
      importance: 0.3 + (i % 7) * 0.1
    }));
    await memory.rememberBatch({ items, concurrency: 8 });
    for (let i = 0; i < 50; i += 1) {
      await memory.recall(`topic ${i % 10}`, { topK: 5 });
    }
  }).run();
});

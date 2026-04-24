import { describe, expect, it } from "vitest";
import {
  AgentMemory,
  withMemory,
  type MemoryMessage,
  type MemoryItem
} from "../src";

// ─── Test embedding function ─────────────────────────────────────────────────

function testEmbed(text: string): number[] {
  const lower = text.toLowerCase();
  return [
    lower.includes("typescript") ? 1 : 0,
    lower.includes("react") ? 1 : 0,
    lower.includes("python") ? 1 : 0,
    lower.length / 200
  ];
}

const embedFn = async (text: string) => testEmbed(text);

// ─── AgentMemory: retrieval ───────────────────────────────────────────────────

describe("AgentMemory — retrieval", () => {
  it("retrieves the most relevant memory using hybrid scoring", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });

    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "language",
      value: "TypeScript",
      importance: 1
    });
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "framework",
      value: "React",
      importance: 0.3
    });

    const recalled = await memory.recall("what language does the user prefer?", {
      sessionId: "s1",
      topK: 1
    });

    expect(recalled).toHaveLength(1);
    const first = recalled[0];
    expect(first?.item.kind).toBe("fact");
    expect(first?.item.kind === "fact" ? first.item.value : "").toBe("TypeScript");
  });

  it("auto-embeds entries so they show up in recall", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });

    await memory.remember({
      role: "user",
      content: "I love TypeScript",
      sessionId: "s-autoembedtest",
      importance: 0.9
    });

    const recalled = await memory.recall("typescript preference", {
      sessionId: "s-autoembedtest",
      topK: 1
    });

    expect(recalled).toHaveLength(1);
    expect(recalled[0]?.item.kind).toBe("entry");
  });

  it("returns results with score breakdown", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({ kind: "fact", sessionId: "s-score", key: "lang", value: "TypeScript" });

    const recalled = await memory.recall("typescript", { sessionId: "s-score" });
    expect(recalled[0]).toMatchObject({
      score: expect.any(Number),
      similarity: expect.any(Number),
      recency: expect.any(Number),
      importance: expect.any(Number)
    });
  });

  it("falls back gracefully when no embed function is configured", async () => {
    const memory = new AgentMemory(); // no embed fn

    await memory.remember({ role: "user", content: "Hello world", sessionId: "s-noembed" });

    // Should not throw, just return based on recency+importance
    const recalled = await memory.recall("Hello world", { sessionId: "s-noembed" });
    expect(Array.isArray(recalled)).toBe(true);
    expect(recalled.length).toBeGreaterThan(0);
  });

  it("applies minScore filter", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({ kind: "fact", sessionId: "s-minscore", key: "a", value: "Python", importance: 0.1 });

    const allResults = await memory.recall("typescript", { sessionId: "s-minscore" });
    const filtered = await memory.recall("typescript", { sessionId: "s-minscore", minScore: 0.99 });

    expect(allResults.length).toBeGreaterThanOrEqual(filtered.length);
  });

  it("applies custom filter callback", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({ kind: "fact", sessionId: "s-filter", key: "lang", value: "TypeScript" });
    await memory.remember({ role: "user", content: "I use Python too", sessionId: "s-filter" });

    const factsOnly = await memory.recall("language", {
      sessionId: "s-filter",
      filter: (item: MemoryItem) => item.kind === "fact"
    });

    expect(factsOnly.every((r) => r.item.kind === "fact")).toBe(true);
  });
});

// ─── AgentMemory: session management ────────────────────────────────────────

describe("AgentMemory — session management", () => {
  it("isolates sessions", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({ kind: "fact", sessionId: "sess-a", key: "x", value: "1" });
    await memory.remember({ kind: "fact", sessionId: "sess-b", key: "x", value: "2" });

    const a = await memory.getBySession("sess-a");
    const b = await memory.getBySession("sess-b");
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("clear() removes all session items", async () => {
    const memory = new AgentMemory();
    await memory.remember({ role: "user", content: "Hello", sessionId: "s-clear" });
    await memory.remember({ role: "assistant", content: "Hi!", sessionId: "s-clear" });

    await memory.clear("s-clear");

    const items = await memory.getBySession("s-clear");
    expect(items).toHaveLength(0);
  });

  it("update() modifies an existing item", async () => {
    const memory = new AgentMemory();
    const fact = await memory.remember({
      kind: "fact",
      sessionId: "s-update",
      key: "lang",
      value: "TypeScript"
    });

    await memory.update(fact.id, { importance: 0.99 });

    const items = await memory.getBySession("s-update");
    const updated = items.find((i) => i.id === fact.id);
    expect(updated?.importance).toBeCloseTo(0.99);
  });

  it("forget() removes a specific item", async () => {
    const memory = new AgentMemory();
    const fact = await memory.remember({
      kind: "fact",
      sessionId: "s-forget",
      key: "lang",
      value: "TypeScript"
    });

    await memory.forget(fact.id);
    const items = await memory.getBySession("s-forget");
    expect(items.find((i) => i.id === fact.id)).toBeUndefined();
  });

  it("stats() returns correct counts", async () => {
    const memory = new AgentMemory();
    await memory.remember({ role: "user", content: "Hello", sessionId: "s-stats" });
    await memory.remember({ role: "assistant", content: "Hi!", sessionId: "s-stats" });
    await memory.remember({ kind: "fact", sessionId: "s-stats", key: "lang", value: "TS" });

    const s = await memory.stats("s-stats");
    expect(s.total).toBe(3);
    expect(s.byKind.entry).toBe(2);
    expect(s.byKind.fact).toBe(1);
    expect(s.byKind.summary).toBe(0);
  });
});

// ─── AgentMemory: summarisation ──────────────────────────────────────────────

describe("AgentMemory — summarisation", () => {
  it("summarises old entries when max turn threshold is exceeded", async () => {
    const memory = new AgentMemory({
      summarisation: {
        maxTurns: 4,
        keepRecentTurns: 2,
        summariseFn: async ({ entries }) =>
          `Summarised ${entries.length} messages into one chunk.`
      }
    });

    for (let i = 0; i < 6; i += 1) {
      await memory.remember({
        sessionId: "s-sum1",
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`
      });
    }

    const summary = await memory.summarise({ sessionId: "s-sum1" });
    expect(summary).not.toBeNull();
    expect(summary?.kind).toBe("summary");

    const all = await memory.getBySession("s-sum1");
    expect(all.some((item) => item.kind === "summary")).toBe(true);
  });

  it("does not summarise if under threshold", async () => {
    const memory = new AgentMemory({
      summarisation: { maxTurns: 20, tokenBudget: 99999 }
    });

    await memory.remember({ role: "user", content: "Hello", sessionId: "s-sum2" });
    await memory.remember({ role: "assistant", content: "Hi!", sessionId: "s-sum2" });

    const summary = await memory.summarise({ sessionId: "s-sum2" });
    expect(summary).toBeNull();
  });

  it("force summarise works regardless of threshold", async () => {
    const memory = new AgentMemory({
      summarisation: {
        maxTurns: 100,
        summariseFn: async ({ entries }) => `Forced summary of ${entries.length} entries.`
      }
    });

    await memory.remember({ role: "user", content: "A", sessionId: "s-sum3" });
    await memory.remember({ role: "user", content: "B", sessionId: "s-sum3" });
    await memory.remember({ role: "user", content: "C", sessionId: "s-sum3" });

    const summary = await memory.summarise({ sessionId: "s-sum3", force: true });
    expect(summary).not.toBeNull();
    expect(summary?.content).toContain("Forced summary");
  });
});

// ─── withMemory middleware ───────────────────────────────────────────────────

describe("withMemory middleware", () => {
  it("injects memory and stores assistant output", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({
      kind: "fact",
      sessionId: "s3",
      key: "preference",
      value: "TypeScript"
    });

    const wrapped = withMemory(
      async (messages: MemoryMessage[]) => {
        const hasMemory = messages.some(
          (message) => message.role === "system" && message.name === "memory"
        );
        return hasMemory ? "Memory injected." : "No memory.";
      },
      { memory, sessionId: "s3" }
    );

    const result = await wrapped([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "What do I prefer?" }
    ]);

    expect(result).toBe("Memory injected.");

    const all = await memory.getBySession("s3");
    expect(
      all.some(
        (item) =>
          item.kind === "entry" &&
          item.role === "assistant" &&
          item.content === "Memory injected."
      )
    ).toBe(true);
  });

  it("does not auto-summarise by default", async () => {
    const summariseFn = async () => "summary";
    const memory = new AgentMemory({
      summarisation: { maxTurns: 1, summariseFn }
    });

    const wrapped = withMemory(
      async () => "Response",
      // autoSummarise not set => defaults to false
      { memory, sessionId: "s-nosumm" }
    );

    for (let i = 0; i < 5; i++) {
      await wrapped([{ role: "user", content: `Message ${i}` }]);
    }

    const all = await memory.getBySession("s-nosumm");
    expect(all.some((item) => item.kind === "summary")).toBe(false);
  });

  it("auto-summarises when autoSummarise: true", async () => {
    const memory = new AgentMemory({
      summarisation: {
        maxTurns: 2,
        keepRecentTurns: 1,
        summariseFn: async ({ entries }) => `Summary of ${entries.length} entries`
      }
    });

    const wrapped = withMemory(
      async () => "Response",
      { memory, sessionId: "s-autosumm", autoSummarise: true }
    );

    for (let i = 0; i < 4; i++) {
      await wrapped([{ role: "user", content: `Turn ${i}` }]);
    }

    const all = await memory.getBySession("s-autosumm");
    expect(all.some((item) => item.kind === "summary")).toBe(true);
  });

  it("does not store empty user messages", async () => {
    const memory = new AgentMemory();
    const wrapped = withMemory(async () => "ok", { memory, sessionId: "s-empty" });

    await wrapped([{ role: "user", content: "   " }]);

    const all = await memory.getBySession("s-empty");
    // Empty/whitespace user message should not be stored
    expect(all.filter((i) => i.kind === "entry" && i.role === "user")).toHaveLength(0);
  });
});

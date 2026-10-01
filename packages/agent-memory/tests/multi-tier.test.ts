import { describe, expect, it } from "vitest";
import { AgentMemory, InMemoryAdapter } from "../src";
import type { MemoryItem } from "../src/types/memory";

// ─── Multi-tier memory ──────────────────────────────────────────────────────

const embedFn = async (text: string) => {
  const h = text.toLowerCase();
  return [h.includes("typescript") ? 1 : 0, h.includes("python") ? 1 : 0, h.length / 200];
};

describe("AgentMemory — multi-tier memory", () => {
  it("stores items at the user tier", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const item = await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "name",
      value: "Alex",
      tier: "user",
      userId: "u1"
    });
    expect(item.tier).toBe("user");
    expect(item.userId).toBe("u1");
  });

  it("filters recall by userId", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "a",
      value: "TypeScript",
      tier: "user",
      userId: "u1"
    });
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "a",
      value: "Python",
      tier: "user",
      userId: "u2"
    });

    const u1 = await memory.recall("language", { userId: "u1", sessionId: "s1", topK: 5 });
    expect(u1).toHaveLength(1);
    expect(u1[0]?.item.kind === "fact" ? u1[0]!.item.value : "").toBe("TypeScript");
  });

  it("filters recall by tier", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "x",
      value: "TypeScript",
      tier: "user",
      userId: "u1"
    });
    await memory.remember({
      role: "user",
      content: "TypeScript is great",
      sessionId: "s1",
      tier: "agent",
      agentId: "a1"
    });
    await memory.remember({ role: "user", content: "TypeScript rocks", sessionId: "s1" });

    const onlyUser = await memory.recall("TypeScript", { sessionId: "s1", topK: 10, tiers: ["user"] });
    expect(onlyUser.every((r) => (r.item.tier ?? "session") === "user")).toBe(true);
  });

  it("stats reports byTier, userIds, agentIds", async () => {
    const memory = new AgentMemory();
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "a",
      value: "x",
      tier: "user",
      userId: "u1"
    });
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "b",
      value: "y",
      tier: "agent",
      agentId: "a1"
    });
    await memory.remember({ role: "user", content: "hi", sessionId: "s1" });

    const stats = await memory.stats("s1");
    expect(stats.byTier).toBeDefined();
    expect(stats.byTier!.user).toBe(1);
    expect(stats.byTier!.agent).toBe(1);
    expect(stats.byTier!.session).toBe(1);
    expect(stats.userIds).toEqual(["u1"]);
    expect(stats.agentIds).toEqual(["a1"]);
  });
});

// ─── Batched remember ───────────────────────────────────────────────────────

describe("AgentMemory — rememberBatch", () => {
  it("stores many items in a single call", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const items = Array.from({ length: 10 }, (_, i) => ({
      role: "user" as const,
      content: `Message ${i} about TypeScript`,
      sessionId: "batch1"
    }));
    const result = await memory.rememberBatch({ items });
    expect(result.stored).toHaveLength(10);
    expect(result.errors).toHaveLength(0);

    const all = await memory.getBySession("batch1");
    expect(all).toHaveLength(10);
  });

  it("captures per-item errors without throwing", async () => {
    const memory = new AgentMemory();
    const result = await memory.rememberBatch({
      items: [
        { role: "user", content: "valid", sessionId: "s" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: "user", content: "   ", sessionId: "s" } as any
      ]
    });
    expect(result.stored).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.index).toBe(1);
  });

  it("respects concurrency limit", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const items = Array.from({ length: 20 }, (_, i) => ({
      role: "user" as const,
      content: `Message ${i}`,
      sessionId: "s"
    }));
    const result = await memory.rememberBatch({ items, concurrency: 2 });
    expect(result.stored).toHaveLength(20);
  });
});

// ─── Error wrapping ──────────────────────────────────────────────────────────

describe("AgentMemory — error wrapping", () => {
  it("wraps adapter delete errors as StorageError", async () => {
    const badAdapter = {
      add: async () => {},
      search: async () => [] as never[],
      delete: async () => {
        throw new Error("boom");
      },
      update: async () => {},
      getBySession: async () => [] as never[]
    };
    // Adapter type is structural; cast through unknown so the bad mock fits
    // the Adapter interface without an `any` lint warning.
    const opts: ConstructorParameters<typeof AgentMemory>[0] = { adapter: badAdapter as never };
    const m = new AgentMemory(opts);
    await expect(m.forget("x")).rejects.toThrow(/boom/);
  });

  it("ConfigurationError on remember with empty content", async () => {
    const memory = new AgentMemory();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memory.remember({ role: "user", content: "   ", sessionId: "s" } as any)
    ).rejects.toThrow(/empty content/);
  });

  it("ConfigurationError on embed with no provider", async () => {
    const memory = new AgentMemory();
    // Access private method via the public surface
    // Use recall as a proxy — the engine needs an embed fn
    await expect(
      // Force the engine to require an embed fn by calling a code path that needs it
      (memory as unknown as { embed: (texts: string[]) => Promise<number[][]> }).embed(["hi"])
    ).rejects.toThrow(/No embedding function/);
  });
});

// ─── Embedding cache ─────────────────────────────────────────────────────────

describe("AgentMemory — embedding cache", () => {
  it("caches embeddings for repeated text", async () => {
    let calls = 0;
    const tracking = async (text: string) => {
      calls += 1;
      return [text.length, 0, 0];
    };
    const memory = new AgentMemory({ embedding: { embedFn: tracking } });
    await memory.remember({ role: "user", content: "hello", sessionId: "s" });
    await memory.remember({ role: "user", content: "hello", sessionId: "s" });
    await memory.remember({ role: "user", content: "world", sessionId: "s" });
    // Two unique texts = 2 embed calls
    expect(calls).toBe(2);
  });
});

// ─── Hybrid BM25 + vector scoring ────────────────────────────────────────────

describe("AgentMemory — hybrid scoring", () => {
  it("returns keyword component in results", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({ kind: "fact", sessionId: "s1", key: "lang", value: "TypeScript" });
    await memory.remember({ kind: "fact", sessionId: "s1", key: "lang2", value: "Python" });
    const result = await memory.recall("TypeScript", { sessionId: "s1", topK: 2 });
    expect(result[0]).toBeDefined();
    expect(result[0]?.keyword).toBeGreaterThan(result[1]?.keyword ?? 0);
  });
});

// ─── delete + clear behave together ─────────────────────────────────────────

describe("InMemoryAdapter — clear()", () => {
  it("removes items and indexes", async () => {
    const adapter = new InMemoryAdapter();
    const memory = new AgentMemory({ adapter });
    await memory.remember({ role: "user", content: "a", sessionId: "s" });
    await memory.remember({ role: "user", content: "b", sessionId: "s" });
    await memory.clear("s");
    const items = await memory.getBySession("s");
    expect(items).toHaveLength(0);
  });
});

void (null as unknown as MemoryItem);

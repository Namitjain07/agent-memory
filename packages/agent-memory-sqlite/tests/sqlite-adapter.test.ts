import { describe, expect, it, beforeEach } from "vitest";
import { AgentMemory } from "@namitjain.india/agent-memory";
import { SQLiteAdapter } from "../src";

function makeMemory() {
  const adapter = new SQLiteAdapter({ dbPath: ":memory:" });
  return new AgentMemory({ adapter });
}

describe("SQLiteAdapter", () => {
  let memory: AgentMemory;

  beforeEach(() => {
    memory = makeMemory();
  });

  it("stores and retrieves a fact", async () => {
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "lang",
      value: "TypeScript"
    });
    const items = await memory.getBySession("s1");
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("fact");
    if (items[0]?.kind === "fact") {
      expect(items[0].value).toBe("TypeScript");
    }
  });

  it("stores and retrieves an entry", async () => {
    await memory.remember({
      role: "user",
      content: "Hello world",
      sessionId: "s2"
    });
    const items = await memory.getBySession("s2");
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("entry");
    if (items[0]?.kind === "entry") {
      expect(items[0].content).toBe("Hello world");
      expect(items[0].role).toBe("user");
    }
  });

  it("persists tier and userId", async () => {
    await memory.remember({
      kind: "fact",
      sessionId: "s3",
      key: "name",
      value: "Alex",
      tier: "user",
      userId: "u1"
    });
    const items = await memory.getBySession("s3");
    expect(items[0]?.tier).toBe("user");
    expect(items[0]?.userId).toBe("u1");
  });

  it("filters search by tier", async () => {
    await memory.remember({
      kind: "fact",
      sessionId: "s4",
      key: "a",
      value: "1",
      tier: "user",
      userId: "u1"
    });
    await memory.remember({
      role: "user",
      content: "2",
      sessionId: "s4"
    });

    const adapter = (memory as unknown as { adapter: SQLiteAdapter }).adapter;
    const results = await adapter.search([1, 0, 0], {
      sessionId: "s4",
      limit: 10,
      tiers: ["user"]
    });
    expect(results.length).toBe(1);
    expect(results[0]?.item.tier).toBe("user");
  });

  it("clear() removes all items in session", async () => {
    await memory.remember({ role: "user", content: "a", sessionId: "s5" });
    await memory.remember({ role: "user", content: "b", sessionId: "s5" });
    await memory.remember({ role: "user", content: "c", sessionId: "s6" });

    await memory.clear("s5");

    expect(await memory.getBySession("s5")).toHaveLength(0);
    expect(await memory.getBySession("s6")).toHaveLength(1);
  });

  it("update() modifies importance", async () => {
    const item = await memory.remember({
      kind: "fact",
      sessionId: "s7",
      key: "x",
      value: "y"
    });
    await memory.update(item.id, { importance: 0.95 });
    const all = await memory.getBySession("s7");
    const updated = all.find((entry) => entry.id === item.id);
    expect(updated?.importance).toBeCloseTo(0.95);
  });

  it("persists summary after summarise()", async () => {
    for (let i = 0; i < 6; i += 1) {
      await memory.remember({
        sessionId: "s8",
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`
      });
    }
    const summary = await memory.summarise({
      sessionId: "s8",
      force: true,
      maxTurns: 4,
      keepRecentTurns: 2
    });
    expect(summary).not.toBeNull();
    const items = await memory.getBySession("s8");
    expect(items.some((entry) => entry.kind === "summary")).toBe(true);
  });

  it("handles duplicate-id insertion (INSERT OR REPLACE)", async () => {
    const adapter = new SQLiteAdapter({ dbPath: ":memory:" });
    const mem = new AgentMemory({ adapter });
    const item = await mem.remember({
      kind: "fact",
      sessionId: "s-dup",
      key: "lang",
      value: "TypeScript",
      importance: 0.5
    });
    // Re-insert with the same id (should NOT throw)
    await mem.remember({
      id: item.id,
      kind: "fact",
      sessionId: "s-dup",
      key: "lang",
      value: "TypeScript (updated)",
      importance: 0.8
    });
    const all = await mem.getBySession("s-dup");
    expect(all).toHaveLength(1);
    const found = all.find((entry) => entry.id === item.id);
    expect(found?.kind === "fact" ? found.value : "").toBe("TypeScript (updated)");
  });
});

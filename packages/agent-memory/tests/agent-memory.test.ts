import { describe, expect, it } from "vitest";
import { AgentMemory, withMemory, type MemoryMessage } from "../src";

function testEmbed(text: string): number[] {
  const lower = text.toLowerCase();
  return [
    lower.includes("typescript") ? 1 : 0,
    lower.includes("react") ? 1 : 0,
    lower.length / 200
  ];
}

describe("AgentMemory", () => {
  it("retrieves the most relevant memory using hybrid scoring", async () => {
    const memory = new AgentMemory({
      embedding: { embedFn: async (text) => testEmbed(text) }
    });

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
        sessionId: "s2",
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`
      });
    }

    const summary = await memory.summarise({ sessionId: "s2" });
    expect(summary).not.toBeNull();
    expect(summary?.kind).toBe("summary");

    const all = await memory.getBySession("s2");
    expect(all.some((item) => item.kind === "summary")).toBe(true);
  });
});

describe("withMemory middleware", () => {
  it("injects memory and stores assistant output", async () => {
    const memory = new AgentMemory({
      embedding: { embedFn: async (text) => testEmbed(text) }
    });
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
});

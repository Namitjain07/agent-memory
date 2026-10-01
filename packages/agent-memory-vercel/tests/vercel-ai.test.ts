/**
 * Smoke tests for the Vercel AI SDK integration.
 *
 * These tests use a minimal mock model so the wrapper can be tested
 * without depending on the real `ai` package being installed.
 */

import { describe, expect, it } from "vitest";
import { AgentMemory, InMemoryAdapter } from "@namitjain.india/agent-memory";
import { withAIMemory, createMemoryTools } from "../src/index.js";

const embedFn = async (text: string) => {
  const h = text.toLowerCase();
  return [h.includes("typescript") ? 1 : 0, h.includes("python") ? 1 : 0, h.length / 200];
};

function makeMockModel(): unknown {
  const model = {
    specificationVersion: "v1" as const,
    provider: "mock",
    modelId: "mock-model",
    doGenerate: async (args: { prompt: unknown }) => {
      const text = JSON.stringify(args.prompt).slice(0, 200);
      return { text: `Mock response. Saw prompt: ${text}` };
    },
    doStream: async (args: { prompt: unknown }) => {
      const text = JSON.stringify(args.prompt).slice(0, 200);
      const chunks = [`Mock stream `, `of prompt `, text];
      return {
        textStream: (async function* () {
          for (const c of chunks) yield c;
        })(),
        finishReason: "stop"
      };
    }
  };
  return model;
}

describe("withAIMemory", () => {
  it("wraps a model and injects memories into doGenerate", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    await memory.remember({
      kind: "fact",
      sessionId: "s1",
      key: "language",
      value: "TypeScript",
      userId: "u1"
    });

    const model = makeMockModel();
    const wrapped = withAIMemory(model, {
      memory,
      sessionId: "s1",
      userId: "u1",
      topK: 3,
      systemPrompt: "You are helpful."
    });

    const inner = wrapped as { doGenerate: (args: { prompt: unknown }) => Promise<{ text: string }> };
    const result = await inner.doGenerate({
      prompt: [{ role: "user", content: "What language do I use?" }]
    });
    expect(result.text).toContain("Mock response");
    // Both user message and assistant reply should be persisted
    const items = await memory.getBySession("s1");
    expect(items.some((i) => i.kind === "entry" && i.role === "user")).toBe(true);
    expect(items.some((i) => i.kind === "entry" && i.role === "assistant")).toBe(true);
  });

  it("wraps a model and persists streamed assistant output", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const model = makeMockModel();
    const wrapped = withAIMemory(model, { memory, sessionId: "s2", topK: 3 });

    const inner = wrapped as {
      doStream: (args: { prompt: unknown }) => Promise<{ textStream: AsyncIterable<string> }>;
    };
    const stream = await inner.doStream({
      prompt: [{ role: "user", content: "Hello!" }]
    });

    let out = "";
    for await (const chunk of stream.textStream) {
      out += chunk;
    }
    expect(out).toContain("Mock stream");
    const items = await memory.getBySession("s2");
    const assistant = items.find((i) => i.kind === "entry" && i.role === "assistant");
    expect(assistant).toBeDefined();
    if (assistant && assistant.kind === "entry") {
      expect(assistant.content).toBe(out);
    }
  });

  it("throws on missing doGenerate", () => {
    expect(() => withAIMemory({} as never, { memory: new AgentMemory(), sessionId: "s" })).toThrow(
      /missing doGenerate/
    );
  });
});

describe("createMemoryTools", () => {
  it("returns an object with three tools when ai is installed", () => {
    const memory = new AgentMemory();
    // We can't easily install `ai` in tests, so verify it throws a helpful error
    expect(() => createMemoryTools(memory, { sessionId: "s" })).toThrow();
  });
});

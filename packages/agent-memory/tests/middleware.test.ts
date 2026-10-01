import { describe, expect, it } from "vitest";
import { AgentMemory, withMemory } from "../src";

const embedFn = async (text: string) => {
  const h = text.toLowerCase();
  return [h.includes("typescript") ? 1 : 0, h.length / 200];
};

describe("withMemory middleware — output extraction", () => {
  it("stores plain string output", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(async () => "Hello from the agent", { memory, sessionId: "s1" });
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s1");
    const assistant = items.find((i) => i.kind === "entry" && i.role === "assistant");
    expect(assistant).toBeDefined();
    if (assistant && assistant.kind === "entry") {
      expect(assistant.content).toBe("Hello from the agent");
    }
  });

  it("extracts content from { content: string } (Anthropic-style)", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(async () => ({ content: "Anthropic-style reply" }), {
      memory,
      sessionId: "s2"
    });
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s2");
    const assistant = items.find((i) => i.kind === "entry" && i.role === "assistant");
    if (assistant && assistant.kind === "entry") {
      expect(assistant.content).toBe("Anthropic-style reply");
    }
  });

  it("extracts content from { choices: [{ message: { content } }] } (OpenAI-style)", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(
      async () => ({
        choices: [{ message: { role: "assistant", content: "OpenAI-style reply" } }]
      }),
      { memory, sessionId: "s3" }
    );
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s3");
    const assistant = items.find((i) => i.kind === "entry" && i.role === "assistant");
    if (assistant && assistant.kind === "entry") {
      expect(assistant.content).toBe("OpenAI-style reply");
    }
  });

  it("extracts content from { output_text } (OpenAI Responses API)", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(async () => ({ output_text: "Responses-API reply" }), {
      memory,
      sessionId: "s4"
    });
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s4");
    const assistant = items.find((i) => i.kind === "entry" && i.role === "assistant");
    if (assistant && assistant.kind === "entry") {
      expect(assistant.content).toBe("Responses-API reply");
    }
  });

  it("extracts content from { content: [{ type: 'text', text }] }", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(async () => ({ content: [{ type: "text", text: "Parts-based reply" }] }), {
      memory,
      sessionId: "s5"
    });
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s5");
    const assistant = items.find((i) => i.kind === "entry" && i.role === "assistant");
    if (assistant && assistant.kind === "entry") {
      expect(assistant.content).toBe("Parts-based reply");
    }
  });

  it("extracts content from { text } (Vercel AI SDK generateText)", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(async () => ({ text: "Vercel-AI-SDK reply" }), { memory, sessionId: "s6" });
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s6");
    const assistant = items.find((i) => i.kind === "entry" && i.role === "assistant");
    if (assistant && assistant.kind === "entry") {
      expect(assistant.content).toBe("Vercel-AI-SDK reply");
    }
  });

  it("does not store when no text is extractable (tool-only response)", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(
      async () => ({
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: "call_123",
                  type: "function",
                  function: { name: "lookup", arguments: "{}" }
                }
              ]
            }
          }
        ]
      }),
      { memory, sessionId: "s7" }
    );
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s7");
    // User turn is stored, but no assistant turn (no text)
    const userTurns = items.filter((i) => i.kind === "entry" && i.role === "user");
    const assistantTurns = items.filter((i) => i.kind === "entry" && i.role === "assistant");
    expect(userTurns).toHaveLength(1);
    expect(assistantTurns).toHaveLength(0);
  });

  it("defaults assistant importance to 0.3 (lower than user)", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(async () => "Plain reply", { memory, sessionId: "s8" });
    await wrapped([{ role: "user", content: "Hi" }]);
    const items = await memory.getBySession("s8");
    const userTurn = items.find((i) => i.kind === "entry" && i.role === "user");
    const assistantTurn = items.find((i) => i.kind === "entry" && i.role === "assistant");
    expect(userTurn?.importance).toBe(0.5); // default
    expect(assistantTurn?.importance).toBe(0.3); // assistant default
  });

  it("honours runOptions.importance for both turns when set", async () => {
    const memory = new AgentMemory({ embedding: { embedFn } });
    const wrapped = withMemory(async () => "Plain reply", { memory, sessionId: "s9" });
    await wrapped([{ role: "user", content: "Hi" }], { importance: 0.9 });
    const items = await memory.getBySession("s9");
    const userTurn = items.find((i) => i.kind === "entry" && i.role === "user");
    const assistantTurn = items.find((i) => i.kind === "entry" && i.role === "assistant");
    expect(userTurn?.importance).toBe(0.9);
    expect(assistantTurn?.importance).toBe(0.9);
  });
});

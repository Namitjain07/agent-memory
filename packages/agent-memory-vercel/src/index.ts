/**
 * @namitjain.india/agent-memory-vercel
 *
 * Drop-in integration with the Vercel AI SDK. Provides:
 *
 *  - `withAIMemory(model, options)` — wraps a Vercel AI SDK `LanguageModelV1`
 *    so that every `streamText` / `generateText` call automatically:
 *      1. Stores the latest user turn in agent-memory
 *      2. Recalls relevant prior memories and prepends them as a system message
 *      3. Stores the assistant turn after the model finishes
 *      4. Optionally summarises when the conversation grows
 *
 *  - `createMemoryTools(memory)` — returns `tool()` definitions compatible
 *    with the AI SDK so the LLM itself can call `memory_recall`,
 *    `memory_remember`, `memory_forget`.
 *
 * @example
 * ```ts
 * import { openai } from "@ai-sdk/openai";
 * import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";
 * import { withAIMemory } from "@namitjain.india/agent-memory-vercel";
 *
 * const provider = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY });
 * const memory = new AgentMemory({ embedding: provider, summarisation: { summariseFn: provider.summarise } });
 *
 * const model = withAIMemory(openai("gpt-4o-mini"), {
 *   memory,
 *   sessionId: "user-123",
 *   systemPrompt: "You are a helpful assistant."
 * });
 *
 * // Now use `model` anywhere the AI SDK accepts a LanguageModelV1.
 * import { streamText } from "ai";
 * const result = streamText({ model, messages });
 * ```
 */

import type { AgentMemory } from "@namitjain.india/agent-memory";
import { createRequire } from "node:module";

export interface AIMemoryOptions {
  memory: AgentMemory;
  sessionId: string;
  userId?: string;
  agentId?: string;
  tier?: "user" | "agent" | "session";
  topK?: number;
  systemPrompt?: string;
  /**
   * Auto-summarise the session after each turn once a threshold is reached.
   * Set to a number to enable with that max-turns threshold; default: undefined (disabled).
   */
  autoSummariseAt?: number;
}

/**
 * Wrap a Vercel AI SDK language model with automatic memory injection.
 *
 * This is a *lightweight* integration — it does not require the AI SDK to be
 * installed at runtime (peer-deps are optional). When the AI SDK is available,
 * `model.specificationVersion === "v1"` and `doGenerate`/`doStream` are
 * intercepted to inject the system message and persist turns.
 *
 * If the AI SDK isn't installed, this function still returns a passthrough
 * object that exposes `name` / `provider` / `modelId` so it can be type-checked
 * and inspected, but invoking generate/stream will throw a helpful error.
 */
export function withAIMemory(model: unknown, options: AIMemoryOptions): unknown {
  const adapter: AIAdapterLike = (model as { __aiAdapter?: AIAdapterLike }).__aiAdapter ?? {
    specificationVersion: ((model as { specificationVersion?: string }).specificationVersion ?? "v1") as
      "v1" | "v2" | "v3",
    provider: (model as { provider?: string }).provider ?? "unknown",
    modelId: (model as { modelId?: string }).modelId ?? "unknown"
  };

  if (!adapter || typeof (model as { doGenerate?: unknown }).doGenerate !== "function") {
    throw new Error(
      "[agent-memory-vercel] withAIMemory requires a Vercel AI SDK LanguageModelV1 (missing doGenerate)."
    );
  }

  const inner = model as AIInner;

  const wrapped: AIInner & { __aiAdapter: AIAdapterLike } = {
    __aiAdapter: adapter,
    specificationVersion: inner.specificationVersion ?? "v1",
    provider: inner.provider ?? adapter.provider,
    modelId: inner.modelId ?? adapter.modelId,

    async doGenerate(args: { prompt: unknown; [key: string]: unknown }) {
      return interceptGenerate(inner, args, options);
    },

    async doStream(args: { prompt: unknown; [key: string]: unknown }) {
      return interceptStream(inner, args, options);
    }
  };

  return wrapped;
}

// ─── Tool definitions (require `ai`) ────────────────────────────────────────

/**
 * Create AI SDK tool definitions for memory operations.
 *
 * The tools let the LLM itself decide when to recall, remember, or forget.
 * If the `ai` package is not installed, this throws.
 *
 * @example
 * ```ts
 * import { streamText } from "ai";
 * const result = streamText({
 *   model,
 *   tools: createMemoryTools(memory),
 *   prompt: "What do you remember about my preferences?"
 * });
 * ```
 */
export function createMemoryTools(
  memory: AgentMemory,
  scope?: { sessionId?: string; userId?: string; agentId?: string }
): Record<string, unknown> {
  // Dynamic import so this package remains importable without `ai` installed.
  let toolFn:
    | ((config: {
        description: string;
        parameters: unknown;
        execute: (args: Record<string, unknown>) => Promise<unknown>;
      }) => unknown)
    | undefined;

  try {
    // `ai` is an optional peer dep; use createRequire so we can keep this
    // function sync (it's part of the public API). If `ai` isn't installed,
    // we throw a clear error below.
    const req = createRequire(import.meta.url);
    const ai = req("ai") as { tool?: typeof toolFn };
    toolFn = ai.tool;
  } catch {
    /* swallow — handled below */
  }

  if (!toolFn) {
    throw new Error("[agent-memory-vercel] createMemoryTools requires the `ai` package to be installed.");
  }

  const sessionId = scope?.sessionId ?? "default";

  return {
    memory_recall: toolFn({
      description: "Search the user's long-term memory for relevant past facts or conversation turns.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          topK: { type: "number", description: "How many memories to return (default 5)" }
        },
        required: ["query"]
      },
      execute: async ({ query, topK }) => {
        const results = await memory.recall(String(query), {
          sessionId,
          ...(typeof topK === "number" ? { topK } : {}),
          ...(scope?.userId ? { userId: scope.userId } : {}),
          ...(scope?.agentId ? { agentId: scope.agentId } : {})
        });
        return results.map((r) => ({
          id: r.item.id,
          kind: r.item.kind,
          score: r.score,
          content: r.item.kind === "fact" ? `${r.item.key}: ${r.item.value}` : r.item.content
        }));
      }
    }),

    memory_remember: toolFn({
      description: "Persist a durable fact to memory (e.g. user preferences, profile data).",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Short identifier (e.g. 'language', 'name')" },
          value: { type: "string", description: "The value to remember" },
          importance: { type: "number", description: "0..1 importance weight (default 0.7)" }
        },
        required: ["key", "value"]
      },
      execute: async ({ key, value, importance }) => {
        const fact = await memory.remember({
          kind: "fact",
          sessionId,
          key: String(key),
          value: String(value),
          importance: typeof importance === "number" ? importance : 0.7,
          ...(scope?.userId ? { userId: scope.userId } : {}),
          ...(scope?.agentId ? { agentId: scope.agentId } : {})
        });
        return { id: fact.id, stored: true };
      }
    }),

    memory_forget: toolFn({
      description: "Delete a memory item by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Memory item id" } },
        required: ["id"]
      },
      execute: async ({ id }) => {
        await memory.forget(String(id));
        return { forgotten: true };
      }
    })
  };
}

// ─── Internal interceptors ──────────────────────────────────────────────────

interface AIAdapterLike {
  specificationVersion: "v1" | "v2" | "v3";
  provider: string;
  modelId: string;
}

interface AIInner {
  specificationVersion?: "v1" | "v2" | "v3";
  provider?: string;
  modelId?: string;
  doGenerate: (args: { prompt: unknown; [key: string]: unknown }) => Promise<unknown>;
  doStream: (args: { prompt: unknown; [key: string]: unknown }) => Promise<unknown>;
}

function lastUserText(prompt: unknown): string | null {
  if (!Array.isArray(prompt)) return null;
  for (let i = prompt.length - 1; i >= 0; i -= 1) {
    const part = prompt[i] as { role?: string; content?: unknown };
    if (part && part.role === "user") {
      if (typeof part.content === "string") return part.content;
      if (Array.isArray(part.content)) {
        const text = part.content
          .map((c) =>
            typeof c === "object" && c && "text" in c ? String((c as { text: unknown }).text) : ""
          )
          .join("");
        return text || null;
      }
    }
  }
  return null;
}

async function interceptGenerate(
  inner: AIInner,
  args: { prompt: unknown; [key: string]: unknown },
  options: AIMemoryOptions
): Promise<unknown> {
  const userText = lastUserText(args.prompt);
  const recallQuery = userText ?? "";
  const recall = recallQuery
    ? await options.memory.recall(recallQuery, {
        sessionId: options.sessionId,
        ...(options.topK !== undefined ? { topK: options.topK } : {}),
        ...(options.userId ? { userId: options.userId } : {}),
        ...(options.agentId ? { agentId: options.agentId } : {}),
        ...(options.tier ? { tier: options.tier } : {})
      })
    : [];

  const memoryBlock =
    recall.length > 0
      ? `Relevant memories about this user:\n${recall
          .map(
            (r, i) =>
              `${i + 1}. [${r.item.kind}] ${r.item.kind === "fact" ? `${r.item.key}: ${r.item.value}` : r.item.content}`
          )
          .join("\n")}`
      : "";

  const augmentedPrompt = augmentPrompt(args.prompt, options.systemPrompt, memoryBlock);

  if (userText && userText.trim()) {
    await options.memory.remember({
      role: "user",
      content: userText,
      sessionId: options.sessionId,
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
      ...(options.tier ? { tier: options.tier } : {})
    });
  }

  const result = (await inner.doGenerate({ ...args, prompt: augmentedPrompt })) as { text?: string };

  if (result.text && result.text.trim()) {
    await options.memory.remember({
      role: "assistant",
      content: result.text,
      sessionId: options.sessionId,
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
      ...(options.tier ? { tier: options.tier } : {})
    });
  }

  if (options.autoSummariseAt !== undefined) {
    const stats = await options.memory.stats(options.sessionId);
    if (stats.byKind.entry > options.autoSummariseAt) {
      await options.memory.summarise({ sessionId: options.sessionId });
    }
  }

  return result;
}

async function interceptStream(
  inner: AIInner,
  args: { prompt: unknown; [key: string]: unknown },
  options: AIMemoryOptions
): Promise<unknown> {
  const userText = lastUserText(args.prompt);
  const recallQuery = userText ?? "";
  const recall = recallQuery
    ? await options.memory.recall(recallQuery, {
        sessionId: options.sessionId,
        ...(options.topK !== undefined ? { topK: options.topK } : {}),
        ...(options.userId ? { userId: options.userId } : {}),
        ...(options.agentId ? { agentId: options.agentId } : {}),
        ...(options.tier ? { tier: options.tier } : {})
      })
    : [];

  const memoryBlock =
    recall.length > 0
      ? `Relevant memories about this user:\n${recall
          .map(
            (r, i) =>
              `${i + 1}. [${r.item.kind}] ${r.item.kind === "fact" ? `${r.item.key}: ${r.item.value}` : r.item.content}`
          )
          .join("\n")}`
      : "";

  const augmentedPrompt = augmentPrompt(args.prompt, options.systemPrompt, memoryBlock);

  if (userText && userText.trim()) {
    await options.memory.remember({
      role: "user",
      content: userText,
      sessionId: options.sessionId,
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
      ...(options.tier ? { tier: options.tier } : {})
    });
  }

  const streamResult = (await inner.doStream({ ...args, prompt: augmentedPrompt })) as {
    textStream?: AsyncIterable<string>;
    finishReason?: string;
  };

  if (streamResult.textStream) {
    const collected: string[] = [];
    const proxied = (async function* () {
      for await (const chunk of streamResult.textStream!) {
        collected.push(chunk);
        yield chunk;
      }
      const final = collected.join("").trim();
      if (final) {
        await options.memory.remember({
          role: "assistant",
          content: final,
          sessionId: options.sessionId,
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.agentId ? { agentId: options.agentId } : {}),
          ...(options.tier ? { tier: options.tier } : {})
        });
        if (options.autoSummariseAt !== undefined) {
          const stats = await options.memory.stats(options.sessionId);
          if (stats.byKind.entry > options.autoSummariseAt) {
            await options.memory.summarise({ sessionId: options.sessionId });
          }
        }
      }
    })();

    return { ...streamResult, textStream: proxied };
  }

  return streamResult;
}

function augmentPrompt(prompt: unknown, systemPrompt: string | undefined, memoryBlock: string): unknown {
  const blocks: string[] = [];
  if (systemPrompt) blocks.push(systemPrompt);
  if (memoryBlock) blocks.push(memoryBlock);

  if (blocks.length === 0) return prompt;

  const memorySystem = { role: "system", content: blocks.join("\n\n") };

  if (Array.isArray(prompt)) {
    // Remove any existing system messages and prepend the new one
    const without = prompt.filter((p) => (p as { role?: string }).role !== "system");
    return [memorySystem, ...without];
  }
  return [memorySystem, ...(Array.isArray(prompt) ? prompt : [])];
}

// Note: Vercel AI SDK message types are intentionally not re-imported here
// to avoid pulling the AI SDK as a hard runtime dependency. Consumers that
// want strict typing should install the `ai` package and import those types
// directly.

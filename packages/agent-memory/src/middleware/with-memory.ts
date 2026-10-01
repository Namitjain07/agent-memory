import { AgentMemory } from "../core/agent-memory";
import type {
  AgentFunction,
  WithMemoryOptions,
  WithMemoryRunOptions
} from "../types/config";
import type { MemoryMessage } from "../types/memory";

/**
 * Try hard to extract a textual representation from any plausible LLM response.
 * Handles:
 *   - plain strings
 *   - `{ content: string }` (Anthropic, custom)
 *   - `{ choices: [{ message: { content: string } }] }` (OpenAI)
 *   - `{ content: Array<{ type: "text", text: string } | ...> }` (Anthropic parts)
 *   - `{ output_text: string }` (Responses API)
 *
 * Returns `null` if no text is found (e.g. tool-only / audio-only responses).
 */
function extractOutputText(output: unknown): string | null {
  if (output == null) return null;

  if (typeof output === "string") {
    return output.trim() || null;
  }

  if (typeof output !== "object") return null;
  const o = output as Record<string, unknown>;

  // OpenAI Chat Completions: { choices: [{ message: { content } }] }
  const choices = o.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as { message?: { content?: unknown } } | undefined;
    const content = first?.message?.content;
    if (typeof content === "string" && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const text = content
        .map((c) => (typeof c === "object" && c && "text" in c ? String((c as { text: unknown }).text) : ""))
        .join("")
        .trim();
      if (text) return text;
    }
  }

  // OpenAI Responses API: { output_text: string } or { output: [{ content: [{ text }] }] }
  if (typeof o.output_text === "string" && o.output_text.trim()) return o.output_text.trim();
  if (Array.isArray(o.output)) {
    const text = (o.output as unknown[])
      .flatMap((item) => {
        if (item && typeof item === "object") {
          const content = (item as { content?: unknown }).content;
          if (Array.isArray(content)) return content;
        }
        return [];
      })
      .map((c) => (typeof c === "object" && c && "text" in c ? String((c as { text: unknown }).text) : ""))
      .join("")
      .trim();
    if (text) return text;
  }

  // Generic: { content: string | Array<{ text: string }> }
  const content = o.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((c) => (typeof c === "object" && c && "text" in c ? String((c as { text: unknown }).text) : ""))
      .join("")
      .trim();
    if (text) return text;
  }

  // Vercel AI SDK generateText result: { text: string }
  if (typeof o.text === "string" && o.text.trim()) return o.text.trim();

  return null;
}

function lastUserMessage(messages: MemoryMessage[]): MemoryMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]!.role === "user") {
      return messages[i]!;
    }
  }
  return null;
}

export function withMemory<TOutput, TExtra extends unknown[] = []>(
  agentFn: AgentFunction<TOutput, TExtra>,
  options: WithMemoryOptions = {}
): (
  messages: MemoryMessage[],
  runOptions?: WithMemoryRunOptions,
  ...extra: TExtra
) => Promise<TOutput> {
  const memory = options.memory ?? new AgentMemory(options);

  return async (
    messages: MemoryMessage[],
    runOptions: WithMemoryRunOptions = {},
    ...extra: TExtra
  ): Promise<TOutput> => {
    const sessionId = runOptions.sessionId ?? options.sessionId ?? "default";
    const userId = runOptions.userId ?? options.userId;
    const agentId = runOptions.agentId ?? options.agentId;
    const tier = runOptions.tier ?? options.tier;
    const userMessage = lastUserMessage(messages);
    const importancePart =
      runOptions.importance !== undefined
        ? { importance: runOptions.importance }
        : {};
    const tierPart = tier !== undefined ? { tier } : {};
    const userIdPart = userId !== undefined ? { userId } : {};
    const agentIdPart = agentId !== undefined ? { agentId } : {};

    // Guard: only store if content is non-empty
    if (options.autoStoreInput !== false && userMessage?.content?.trim()) {
      await memory.remember({
        role: "user",
        content: userMessage.content,
        sessionId,
        ...importancePart,
        ...tierPart,
        ...userIdPart,
        ...agentIdPart
      });
    }

    const topKPart = runOptions.topK ?? options.topK;
    const injectedMessages = await memory.inject(messages, {
      sessionId,
      ...(topKPart !== undefined ? { topK: topKPart } : {}),
      ...(userId !== undefined ? { userId } : {}),
      ...(agentId !== undefined ? { agentId } : {}),
      ...(tier !== undefined ? { tier } : {})
    });
    const output = await agentFn(injectedMessages, ...extra);

    if (options.autoStoreOutput !== false) {
      const outputText = extractOutputText(output);
      if (outputText) {
        // Assistant turns default to a lower importance than user turns
        // unless the caller explicitly set an importance on the run options.
        const assistantImportance =
          runOptions.importance !== undefined
            ? importancePart
            : { importance: 0.3 };
        await memory.remember({
          role: "assistant",
          content: outputText,
          sessionId,
          ...assistantImportance,
          ...tierPart,
          ...userIdPart,
          ...agentIdPart
        });
      }
    }

    // autoSummarise defaults to FALSE — only run if explicitly enabled
    if (options.autoSummarise === true) {
      await memory.summarise({ sessionId });
    }

    return output;
  };
}

import { AgentMemory } from "../core/agent-memory";
import type {
  AgentFunction,
  WithMemoryOptions,
  WithMemoryRunOptions
} from "../types/config";
import type { MemoryMessage } from "../types/memory";

function extractOutputText(output: unknown): string | null {
  if (typeof output === "string") {
    return output.trim() || null;
  }

  if (
    output &&
    typeof output === "object" &&
    "content" in output &&
    typeof (output as { content?: unknown }).content === "string"
  ) {
    const content = (output as { content: string }).content.trim();
    return content || null;
  }

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
        await memory.remember({
          role: "assistant",
          content: outputText,
          sessionId,
          ...importancePart,
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

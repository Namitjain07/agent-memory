import { AgentMemory } from "../core/agent-memory";
import type {
  AgentFunction,
  WithMemoryOptions,
  WithMemoryRunOptions
} from "../types/config";
import type { MemoryMessage } from "../types/memory";

function extractOutputText(output: unknown): string | null {
  if (typeof output === "string") {
    return output;
  }

  if (
    output &&
    typeof output === "object" &&
    "content" in output &&
    typeof (output as { content?: unknown }).content === "string"
  ) {
    return (output as { content: string }).content;
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
    const userMessage = lastUserMessage(messages);
    const importancePart =
      runOptions.importance !== undefined
        ? { importance: runOptions.importance }
        : {};

    if (options.autoStoreInput !== false && userMessage) {
      await memory.remember({
        role: "user",
        content: userMessage.content,
        sessionId,
        ...importancePart
      });
    }

    const topKPart = runOptions.topK ?? options.topK;
    const injectedMessages = await memory.inject(messages, {
      sessionId,
      ...(topKPart !== undefined ? { topK: topKPart } : {})
    });
    const output = await agentFn(injectedMessages, ...extra);

    if (options.autoStoreOutput !== false) {
      const outputText = extractOutputText(output);
      if (outputText) {
        await memory.remember({
          role: "assistant",
          content: outputText,
          sessionId,
          ...importancePart
        });
      }
    }

    if (options.autoSummarise !== false) {
      await memory.summarise({ sessionId });
    }

    return output;
  };
}

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import {
  AgentMemory,
  InMemoryAdapter,
  type AgentMemoryOptions,
  type MemoryItem,
  type MemoryMessage,
  type RecallOptions,
  type RecallResult,
  type RememberInput
} from "@namitjain07/agent-memory";

export interface UseMemoryOptions extends Omit<AgentMemoryOptions, "defaultSessionId"> {
  memory?: AgentMemory;
  initialMessages?: MemoryMessage[];
}

export interface UseMemoryResult {
  messages: MemoryMessage[];
  setMessages: Dispatch<SetStateAction<MemoryMessage[]>>;
  remember: (input: Omit<RememberInput, "sessionId">) => Promise<MemoryItem>;
  recall: (query: string, options?: Omit<RecallOptions, "sessionId">) => Promise<RecallResult[]>;
  forget: (id: string) => Promise<void>;
  inject: (
    messages: MemoryMessage[],
    options?: Omit<RecallOptions, "sessionId"> & { query?: string }
  ) => Promise<MemoryMessage[]>;
  memory: AgentMemory;
}

export function useMemory(
  sessionId: string,
  options: UseMemoryOptions = {}
): UseMemoryResult {
  const { memory: providedMemory, initialMessages, ...memoryOptions } = options;
  const [messages, setMessages] = useState<MemoryMessage[]>(
    initialMessages ?? []
  );

  const memoryRef = useRef<AgentMemory>(
    providedMemory ??
      new AgentMemory({
        ...memoryOptions,
        adapter: memoryOptions.adapter ?? new InMemoryAdapter(),
        defaultSessionId: sessionId
      })
  );
  const memory = memoryRef.current;

  const remember = useCallback(
    async (input: Omit<RememberInput, "sessionId">): Promise<MemoryItem> => {
      const item = await memory.remember({
        ...input,
        sessionId
      } as RememberInput);

      if (item.kind === "entry") {
        setMessages((previous) => [
          ...previous,
          { role: item.role, content: item.content }
        ]);
      }

      return item;
    },
    [memory, sessionId]
  );

  const recall = useCallback(
    (query: string, recallOptions: Omit<RecallOptions, "sessionId"> = {}) =>
      memory.recall(query, { ...recallOptions, sessionId }),
    [memory, sessionId]
  );

  const forget = useCallback((id: string) => memory.forget(id), [memory]);

  const inject = useCallback(
    async (
      currentMessages: MemoryMessage[],
      injectOptions: Omit<RecallOptions, "sessionId"> & { query?: string } = {}
    ) =>
      {
        const queryPart =
          injectOptions.query !== undefined ? { query: injectOptions.query } : {};
        return memory.inject(currentMessages, {
          ...injectOptions,
          ...queryPart,
          sessionId
        });
      },
    [memory, sessionId]
  );

  return {
    messages,
    setMessages,
    remember,
    recall,
    forget,
    inject,
    memory
  };
}

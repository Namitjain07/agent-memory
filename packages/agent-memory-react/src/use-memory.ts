import type { Dispatch, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import {
  AgentMemory,
  InMemoryAdapter,
  type AgentMemoryOptions,
  type MemoryItem,
  type MemoryMessage,
  type MemoryStats,
  type RecallOptions,
  type RecallResult,
  type RememberInput,
  type SummariseOptions,
  type MemorySummary
} from "@namitjain.india/agent-memory";

export interface UseMemoryOptions extends Omit<AgentMemoryOptions, "defaultSessionId"> {
  memory?: AgentMemory;
  initialMessages?: MemoryMessage[];
}

export interface UseMemoryResult {
  messages: MemoryMessage[];
  setMessages: Dispatch<SetStateAction<MemoryMessage[]>>;
  isLoading: boolean;
  error: Error | null;
  remember: (input: Omit<RememberInput, "sessionId">) => Promise<MemoryItem>;
  recall: (query: string, options?: Omit<RecallOptions, "sessionId">) => Promise<RecallResult[]>;
  forget: (id: string) => Promise<void>;
  inject: (
    messages: MemoryMessage[],
    options?: Omit<RecallOptions, "sessionId"> & { query?: string }
  ) => Promise<MemoryMessage[]>;
  summarise: (options?: Omit<SummariseOptions, "sessionId">) => Promise<MemorySummary | null>;
  clearSession: () => Promise<void>;
  stats: () => Promise<MemoryStats>;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const memoryRef = useRef<AgentMemory>(
    providedMemory ??
      new AgentMemory({
        ...memoryOptions,
        adapter: memoryOptions.adapter ?? new InMemoryAdapter(),
        defaultSessionId: sessionId
      })
  );
  const memory = memoryRef.current;

  const wrapAsyncFn = <T>(fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    setError(null);
    return fn()
      .catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      })
      .finally(() => setIsLoading(false));
  };
  // Stable ref so callbacks below don't re-create on every render
  const wrapAsyncRef = useRef(wrapAsyncFn);
  wrapAsyncRef.current = wrapAsyncFn;
  const wrapAsync = <T>(fn: () => Promise<T>): Promise<T> =>
    wrapAsyncRef.current(fn);

  const remember = useCallback(
    (input: Omit<RememberInput, "sessionId">): Promise<MemoryItem> =>
      wrapAsync(async () => {
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
      }),
    [memory, sessionId, wrapAsync]
  );

  const recall = useCallback(
    (query: string, recallOptions: Omit<RecallOptions, "sessionId"> = {}) =>
      wrapAsync(() => memory.recall(query, { ...recallOptions, sessionId })),
    [memory, sessionId, wrapAsync]
  );

  const forget = useCallback(
    (id: string) => wrapAsync(() => memory.forget(id)),
    [memory, wrapAsync]
  );

  const inject = useCallback(
    async (
      currentMessages: MemoryMessage[],
      injectOptions: Omit<RecallOptions, "sessionId"> & { query?: string } = {}
    ) => {
      const queryPart =
        injectOptions.query !== undefined ? { query: injectOptions.query } : {};
      return wrapAsync(() =>
        memory.inject(currentMessages, {
          ...injectOptions,
          ...queryPart,
          sessionId
        })
      );
    },
    [memory, sessionId, wrapAsync]
  );

  const summarise = useCallback(
    (summariseOptions: Omit<SummariseOptions, "sessionId"> = {}) =>
      wrapAsync(() => memory.summarise({ ...summariseOptions, sessionId })),
    [memory, sessionId, wrapAsync]
  );

  const clearSession = useCallback(
    () =>
      wrapAsync(async () => {
        await memory.clear(sessionId);
        setMessages([]);
      }),
    [memory, sessionId, wrapAsync]
  );

  const stats = useCallback(
    () => wrapAsync(() => memory.stats(sessionId)),
    [memory, sessionId, wrapAsync]
  );

  return {
    messages,
    setMessages,
    isLoading,
    error,
    remember,
    recall,
    forget,
    inject,
    summarise,
    clearSession,
    stats,
    memory
  };
}

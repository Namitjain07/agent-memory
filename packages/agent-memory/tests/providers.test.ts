import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  createProvider,
  openaiProvider,
  nvidiaProvider,
  mistralProvider,
  cohereProvider,
  googleProvider,
  anthropicProvider,
  voyageProvider,
  ollamaProvider,
  azureOpenAIProvider,
  type MemoryProvider
} from "../src/providers/index";

// ─── Mock fetch ──────────────────────────────────────────────────────────────

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertProviderShape(provider: MemoryProvider, name: string, hasSummarise: boolean) {
  expect(provider.name).toBe(name);
  expect(typeof provider.embedFn).toBe("function");
  expect(typeof provider.embedBatchFn).toBe("function");
  if (hasSummarise) {
    expect(typeof provider.summarise).toBe("function");
  } else {
    expect(provider.summarise).toBeUndefined();
  }
}

const FAKE_EMBEDDING = [0.1, 0.2, 0.3];
const FAKE_ENTRIES = [
  { id: "1", kind: "entry" as const, sessionId: "s", role: "user" as const, content: "Hello", timestamp: 1, importance: 0.5 },
  { id: "2", kind: "entry" as const, sessionId: "s", role: "assistant" as const, content: "Hi!", timestamp: 2, importance: 0.5 }
];

// ─── createProvider factory ───────────────────────────────────────────────────

describe("createProvider factory", () => {
  it("routes to the correct provider by name", () => {
    const names = ["openai", "nvidia", "mistral", "cohere", "google", "anthropic", "voyage", "ollama"] as const;
    for (const name of names) {
      const opts = name === "ollama" || name === "anthropic" || name === "voyage"
        ? { apiKey: "key" }
        : { apiKey: "key" };
      // Just check it doesn't throw and returns the right name
      const p = createProvider(name as "openai", opts as never);
      expect(p.name).toBe(name);
    }
  });

  it("throws for unknown provider name", () => {
    expect(() => createProvider("unknown" as "openai", {} as never)).toThrow();
  });
});

// ─── OpenAI-compatible ───────────────────────────────────────────────────────

describe("openaiProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFetch({
      data: [{ embedding: FAKE_EMBEDDING }]
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has correct shape", () => {
    assertProviderShape(openaiProvider({ apiKey: "k" }), "openai", true);
  });

  it("embedFn returns the embedding from the API", async () => {
    const provider = openaiProvider({ apiKey: "test-key" });
    const result = await provider.embedFn("hello");
    expect(result).toEqual(FAKE_EMBEDDING);
  });

  it("embedBatchFn calls /embeddings with input array", async () => {
    const provider = openaiProvider({ apiKey: "test-key" });
    vi.stubGlobal("fetch", makeFetch({ data: [{ embedding: FAKE_EMBEDDING }, { embedding: FAKE_EMBEDDING }] }));

    const result = await provider.embedBatchFn(["a", "b"]);
    expect(result).toHaveLength(2);

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const body = JSON.parse((call as [string, RequestInit])[1]?.body as string);
    expect(body.input).toEqual(["a", "b"]);
    expect(body.model).toBe("text-embedding-3-small");
  });

  it("uses custom baseURL and model", async () => {
    const provider = openaiProvider({
      apiKey: "k",
      baseURL: "https://my-proxy.com/v1",
      embeddingModel: "custom-model"
    });
    await provider.embedFn("test");

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toBe("https://my-proxy.com/v1/embeddings");
    const body = JSON.parse((call as [string, RequestInit])[1]?.body as string);
    expect(body.model).toBe("custom-model");
  });

  it("sends Authorization header", async () => {
    const provider = openaiProvider({ apiKey: "my-secret" });
    await provider.embedFn("test");

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const headers = (call as [string, RequestInit])[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-secret");
  });

  it("summarise calls /chat/completions", async () => {
    vi.stubGlobal("fetch", makeFetch({
      choices: [{ message: { content: "  Summary text  " } }]
    }));
    const provider = openaiProvider({ apiKey: "k" });
    const result = await provider.summarise!({ sessionId: "s", entries: FAKE_ENTRIES, tokenCount: 10 });
    expect(result).toBe("Summary text");

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("chat/completions");
  });

  it("returns empty array for embedBatchFn([]) without calling fetch", async () => {
    const provider = openaiProvider({ apiKey: "k" });
    const result = await provider.embedBatchFn([]);
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ─── NVIDIA ──────────────────────────────────────────────────────────────────

describe("nvidiaProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has correct shape and uses NVIDIA base URL", async () => {
    vi.stubGlobal("fetch", makeFetch({ data: [{ embedding: FAKE_EMBEDDING }] }));
    assertProviderShape(nvidiaProvider({ apiKey: "k" }), "nvidia", true);

    const provider = nvidiaProvider({ apiKey: "k" });
    await provider.embedFn("test");
    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("integrate.api.nvidia.com");
  });
});

// ─── Mistral ─────────────────────────────────────────────────────────────────

describe("mistralProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has correct shape and uses Mistral base URL", async () => {
    vi.stubGlobal("fetch", makeFetch({ data: [{ embedding: FAKE_EMBEDDING }] }));
    assertProviderShape(mistralProvider({ apiKey: "k" }), "mistral", true);

    const provider = mistralProvider({ apiKey: "k" });
    await provider.embedFn("test");
    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("api.mistral.ai");
  });
});

// ─── Azure OpenAI ─────────────────────────────────────────────────────────────

describe("azureOpenAIProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has correct shape", () => {
    const provider = azureOpenAIProvider({
      apiKey: "k",
      endpoint: "https://my.openai.azure.com",
      embeddingDeployment: "text-embedding-3-small",
      chatDeployment: "gpt-4o-mini"
    });
    assertProviderShape(provider, "azure", true);
  });

  it("uses deployment-based URL and api-key header", async () => {
    vi.stubGlobal("fetch", makeFetch({ data: [{ embedding: FAKE_EMBEDDING }] }));
    const provider = azureOpenAIProvider({
      apiKey: "azure-secret",
      endpoint: "https://myres.openai.azure.com",
      embeddingDeployment: "my-embed-deployment"
    });
    await provider.embedFn("test");

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("myres.openai.azure.com");
    expect((call as [string])[0]).toContain("my-embed-deployment");
    const headers = (call as [string, RequestInit])[1]?.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("azure-secret");
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("summarise is undefined when no chatDeployment is given", () => {
    const provider = azureOpenAIProvider({
      apiKey: "k",
      endpoint: "https://myres.openai.azure.com",
      embeddingDeployment: "embed"
    });
    expect(provider.summarise).toBeUndefined();
  });
});

// ─── Cohere ──────────────────────────────────────────────────────────────────

describe("cohereProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has correct shape", () => {
    assertProviderShape(cohereProvider({ apiKey: "k" }), "cohere", true);
  });

  it("calls Cohere /embed with correct body", async () => {
    vi.stubGlobal("fetch", makeFetch({ embeddings: { float: [FAKE_EMBEDDING] } }));
    const provider = cohereProvider({ apiKey: "k" });
    const result = await provider.embedFn("hello");
    expect(result).toEqual(FAKE_EMBEDDING);

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("api.cohere.com");
    const body = JSON.parse((call as [string, RequestInit])[1]?.body as string);
    expect(body.embedding_types).toEqual(["float"]);
  });

  it("summarise calls /chat", async () => {
    vi.stubGlobal("fetch", makeFetch({
      message: { content: [{ type: "text", text: "  Summary  " }] }
    }));
    const provider = cohereProvider({ apiKey: "k" });
    const result = await provider.summarise!({ sessionId: "s", entries: FAKE_ENTRIES, tokenCount: 5 });
    expect(result).toBe("Summary");
  });
});

// ─── Google ──────────────────────────────────────────────────────────────────

describe("googleProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has correct shape", () => {
    assertProviderShape(googleProvider({ apiKey: "k" }), "google", true);
  });

  it("embedFn calls embedContent with key in URL", async () => {
    vi.stubGlobal("fetch", makeFetch({ embedding: { values: FAKE_EMBEDDING } }));
    const provider = googleProvider({ apiKey: "google-key" });
    const result = await provider.embedFn("hello");
    expect(result).toEqual(FAKE_EMBEDDING);

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("key=google-key");
    expect((call as [string])[0]).toContain("embedContent");
  });

  it("embedBatchFn calls batchEmbedContents", async () => {
    vi.stubGlobal("fetch", makeFetch({
      embeddings: [{ values: FAKE_EMBEDDING }, { values: FAKE_EMBEDDING }]
    }));
    const provider = googleProvider({ apiKey: "k" });
    const result = await provider.embedBatchFn(["a", "b"]);
    expect(result).toHaveLength(2);

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("batchEmbedContents");
  });
});

// ─── Anthropic ───────────────────────────────────────────────────────────────

describe("anthropicProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has summarise but embedFn returns empty array (no fetch call)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const provider = anthropicProvider({ apiKey: "k" });
    expect(provider.name).toBe("anthropic");
    expect(provider.summarise).toBeDefined();

    const vec = await provider.embedFn("test");
    expect(vec).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("summarise calls Anthropic messages API", async () => {
    vi.stubGlobal("fetch", makeFetch({
      content: [{ type: "text", text: "  Claude summary  " }]
    }));
    const provider = anthropicProvider({ apiKey: "ant-key" });
    const result = await provider.summarise!({ sessionId: "s", entries: FAKE_ENTRIES, tokenCount: 5 });
    expect(result).toBe("Claude summary");

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("api.anthropic.com");
    const headers = (call as [string, RequestInit])[1]?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("ant-key");
    expect(headers["anthropic-version"]).toBeDefined();
  });
});

// ─── Voyage ──────────────────────────────────────────────────────────────────

describe("voyageProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has embedFn + embedBatchFn but no summarise", () => {
    assertProviderShape(voyageProvider({ apiKey: "k" }), "voyage", false);
  });

  it("calls Voyage /embeddings", async () => {
    vi.stubGlobal("fetch", makeFetch({ data: [{ embedding: FAKE_EMBEDDING }] }));
    const provider = voyageProvider({ apiKey: "voyage-key" });
    const result = await provider.embedFn("hello");
    expect(result).toEqual(FAKE_EMBEDDING);

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("voyageai.com");
  });
});

// ─── Ollama ──────────────────────────────────────────────────────────────────

describe("ollamaProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has correct shape and requires no API key", () => {
    const provider = ollamaProvider();
    assertProviderShape(provider, "ollama", true);
  });

  it("calls Ollama /api/embed", async () => {
    vi.stubGlobal("fetch", makeFetch({ embeddings: [FAKE_EMBEDDING] }));
    const provider = ollamaProvider({ embeddingModel: "my-model" });
    const result = await provider.embedFn("test");
    expect(result).toEqual(FAKE_EMBEDDING);

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("localhost:11434/api/embed");
    const body = JSON.parse((call as [string, RequestInit])[1]?.body as string);
    expect(body.model).toBe("my-model");
  });

  it("summarise calls /api/chat", async () => {
    vi.stubGlobal("fetch", makeFetch({
      message: { content: "  Ollama summary  " }
    }));
    const provider = ollamaProvider({ chatModel: "llama3.2" });
    const result = await provider.summarise!({ sessionId: "s", entries: FAKE_ENTRIES, tokenCount: 5 });
    expect(result).toBe("Ollama summary");

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("api/chat");
  });

  it("uses custom baseURL", async () => {
    vi.stubGlobal("fetch", makeFetch({ embeddings: [FAKE_EMBEDDING] }));
    const provider = ollamaProvider({ baseURL: "http://my-gpu-server:11434" });
    await provider.embedFn("test");

    const [call] = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect((call as [string])[0]).toContain("my-gpu-server:11434");
  });
});

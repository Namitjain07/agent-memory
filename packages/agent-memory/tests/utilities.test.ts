import { describe, expect, it } from "vitest";
import { LRU } from "../src/utils/lru";
import { redactPII, piiScan } from "../src/utils/pii";
import { bm25Scores, tokenize } from "../src/utils/bm25";
import { cosineSimilarity, clamp, normalizeSimilarity } from "../src/utils/math";
import { recencyScore } from "../src/utils/time";
import { approximateTokenCount } from "../src/utils/tokens";
import { deduplicateSimilarFacts, mergeSimilarEntries } from "../src/utils/memory-ops";
import {
  MemoryError,
  ProviderError,
  ConfigurationError,
  NetworkError,
  TimeoutError,
  AbortError,
  isMemoryError
} from "../src/utils/errors";
import { fetchJSON, DEFAULT_RETRY_POLICY } from "../src/utils/http";
import {
  encrypt,
  decrypt,
  generateKey,
  generateSalt,
  keyFromPassphrase,
  envelopeFromString
} from "../src/utils/encryption";
import type { MemoryItem, MemoryEntry, MemoryFact } from "../src/types/memory";

// ─── LRU ─────────────────────────────────────────────────────────────────────

describe("LRU", () => {
  it("returns undefined for missing keys", () => {
    const cache = new LRU<string, number>(3);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves values", () => {
    const cache = new LRU<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(2);
  });

  it("evicts oldest entry when over capacity", () => {
    const cache = new LRU<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("refreshes recency on get", () => {
    const cache = new LRU<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    // Touch "a" so it's most recently used
    cache.get("a");
    cache.set("c", 3);
    // "b" should now be evicted
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
  });

  it("throws on zero-size cache", () => {
    expect(() => new LRU(0)).toThrow();
  });
});

// ─── PII ─────────────────────────────────────────────────────────────────────

describe("PII redaction", () => {
  it("redacts emails", () => {
    const result = piiScan("Contact me at john@example.com please");
    expect(result.redacted).toBe("Contact me at [REDACTED] please");
    expect(result.detections).toEqual([{ category: "email", count: 1 }]);
  });

  it("redacts multiple categories", () => {
    const text = "Email john@example.com, SSN 123-45-6789, IP 10.0.0.1";
    const result = piiScan(text);
    expect(result.redacted).not.toContain("john@example.com");
    expect(result.redacted).not.toContain("123-45-6789");
    expect(result.redacted).not.toContain("10.0.0.1");
    expect(result.detections.length).toBeGreaterThanOrEqual(3);
  });

  it("honours category filter", () => {
    const result = piiScan("john@example.com and 123-45-6789", { categories: ["email"] });
    expect(result.redacted).not.toContain("john@example.com");
    expect(result.redacted).toContain("123-45-6789");
  });

  it("labels redactions when requested", () => {
    const text = redactPII("hi john@example.com", { labelReplacement: true });
    expect(text).toBe("hi [REDACTED:email]");
  });
});

// ─── BM25 ────────────────────────────────────────────────────────────────────

describe("BM25", () => {
  const items: MemoryItem[] = [
    {
      id: "1",
      kind: "entry",
      sessionId: "s",
      role: "user",
      content: "I love TypeScript and React",
      timestamp: 1,
      importance: 0.5
    } as MemoryEntry,
    {
      id: "2",
      kind: "entry",
      sessionId: "s",
      role: "user",
      content: "Python is great too",
      timestamp: 2,
      importance: 0.5
    } as MemoryEntry,
    {
      id: "3",
      kind: "fact",
      sessionId: "s",
      key: "name",
      value: "Alice",
      content: "name: Alice",
      timestamp: 3,
      importance: 0.5
    } as MemoryFact
  ];

  it("tokenises lowercase words", () => {
    expect(tokenize("Hello, World! 2024")).toEqual(["hello", "world", "2024"]);
  });

  it("returns empty for empty query", () => {
    const scores = bm25Scores("", items);
    expect(scores.size).toBe(0);
  });

  it("scores matches higher than non-matches", () => {
    const scores = bm25Scores("TypeScript", items);
    expect(scores.get("1") ?? 0).toBeGreaterThan(scores.get("2") ?? 0);
  });

  it("normalises max to 1", () => {
    const scores = bm25Scores("TypeScript Python", items);
    let max = 0;
    for (const v of scores.values()) if (v > max) max = v;
    expect(max).toBeLessThanOrEqual(1.0001);
  });
});

// ─── Math / time / tokens ────────────────────────────────────────────────────

describe("Math utilities", () => {
  it("clamp respects bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("cosineSimilarity handles edge cases", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it("normalizeSimilarity maps [-1, 1] to [0, 1]", () => {
    expect(normalizeSimilarity(-1)).toBe(0);
    expect(normalizeSimilarity(0)).toBeCloseTo(0.5);
    expect(normalizeSimilarity(1)).toBe(1);
  });

  it("recencyScore decreases with time", () => {
    const now = 1_000_000;
    const earlier = now - 3_600_000; // 1 hour ago
    const later = now - 60_000; // 1 minute ago
    expect(recencyScore(later, now, 0.03)).toBeGreaterThan(recencyScore(earlier, now, 0.03));
  });

  it("approximateTokenCount is non-zero for non-empty text", () => {
    expect(approximateTokenCount("")).toBe(0);
    expect(approximateTokenCount("hello world")).toBeGreaterThan(0);
  });
});

// ─── Memory ops (dedup / merge) ─────────────────────────────────────────────

describe("memory-ops", () => {
  function factWith(id: string, embedding: number[], value: string, timestamp = 1): MemoryFact {
    return {
      id,
      kind: "fact",
      sessionId: "s",
      key: "k",
      value,
      content: `k: ${value}`,
      embedding,
      timestamp,
      importance: 0.5
    };
  }

  it("deduplicates near-identical facts", () => {
    const items = [
      factWith("a", [1, 0, 0], "TypeScript"),
      factWith("b", [1, 0.001, 0], "TypeScript"),
      factWith("c", [0, 1, 0], "Python")
    ];
    const deduped = deduplicateSimilarFacts(items, { threshold: 0.95 });
    expect(deduped.length).toBe(2);
  });

  it("merges near-duplicate facts into a single item", () => {
    const items = [factWith("a", [1, 0, 0], "TypeScript", 1), factWith("b", [1, 0.001, 0], "TypeScript", 2)];
    const merged = mergeSimilarEntries(items, { threshold: 0.95 });
    expect(merged.length).toBe(1);
    const first = merged[0]!;
    expect(first.kind).toBe("fact");
    if (first.kind === "fact") {
      expect(first.timestamp).toBe(2); // keeps the latest
    }
  });

  it("keeps items with no embedding", () => {
    const items: MemoryItem[] = [
      {
        id: "a",
        kind: "fact",
        sessionId: "s",
        key: "k",
        value: "v",
        content: "k: v",
        timestamp: 1,
        importance: 0.5
      }
    ];
    const deduped = deduplicateSimilarFacts(items);
    expect(deduped.length).toBe(1);
  });
});

// ─── Error hierarchy ─────────────────────────────────────────────────────────

describe("Error hierarchy", () => {
  it("isMemoryError detects all subclasses", () => {
    expect(isMemoryError(new ProviderError("test", 500))).toBe(true);
    expect(isMemoryError(new ConfigurationError("test"))).toBe(true);
    expect(isMemoryError(new NetworkError("test"))).toBe(true);
    expect(isMemoryError(new TimeoutError("test"))).toBe(true);
    expect(isMemoryError(new AbortError("test"))).toBe(true);
    expect(isMemoryError(new MemoryError("test"))).toBe(true);
    expect(isMemoryError(new Error("plain"))).toBe(false);
  });

  it("ProviderError stores status code", () => {
    const err = new ProviderError("HTTP 429", 429);
    expect(err.status).toBe(429);
    expect(err.name).toBe("ProviderError");
  });

  it("ConfigurationError stores context", () => {
    const err = new ConfigurationError("bad", { source: "test" });
    expect(err.context.source).toBe("test");
  });
});

// ─── HTTP retry/timeout/AbortSignal ─────────────────────────────────────────

describe("fetchJSON with retry/timeout/AbortSignal", () => {
  it("retries on 503 and eventually succeeds", async () => {
    let calls = 0;
    const fetchMock = async (_url: string, _init: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    const result = await fetchJSON<{ ok: boolean }>(
      "https://example.com",
      { a: 1 },
      {},
      {
        retry: {
          maxAttempts: 3,
          initialDelayMs: 1,
          maxDelayMs: 5,
          backoffMultiplier: 1,
          jitter: false,
          retryableStatuses: [503]
        }
      }
    );
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("does not retry on 400", async () => {
    let calls = 0;
    const fetchMock = async () => {
      calls += 1;
      return new Response("Bad Request", { status: 400 });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    await expect(
      fetchJSON(
        "https://example.com",
        {},
        {},
        {
          retry: {
            maxAttempts: 3,
            initialDelayMs: 1,
            maxDelayMs: 5,
            backoffMultiplier: 1,
            jitter: false,
            retryableStatuses: [503]
          }
        }
      )
    ).rejects.toThrow(/HTTP 400/);
    expect(calls).toBe(1);
  });

  it("throws TimeoutError when request takes too long", async () => {
    const fetchMock = async (_url: string, init: RequestInit) => {
      // Listen to the abort signal and resolve a delayed response
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response('{"ok":true}', { status: 200 })), 100);
        init.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    await expect(
      fetchJSON("https://example.com", {}, {}, { timeoutMs: 10, retry: { maxAttempts: 1 } })
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("throws AbortError when caller signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchJSON("https://example.com", {}, {}, { signal: controller.signal })
    ).rejects.toBeInstanceOf(AbortError);
  });

  it("uses DEFAULT_RETRY_POLICY as baseline", () => {
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_POLICY.retryableStatuses).toContain(429);
  });
});

// ─── Encryption ─────────────────────────────────────────────────────────────

describe("encryption", () => {
  it("round-trips a string", () => {
    const key = generateKey();
    const envelope = encrypt("hello world", key);
    expect(envelope.alg).toBe("aes-256-gcm");
    expect(envelope.v).toBe(1);
    expect(decrypt(envelope, key)).toBe("hello world");
  });

  it("throws on tampered ciphertext", () => {
    const key = generateKey();
    const envelope = encrypt("hello", key);
    const tampered = {
      ...envelope,
      ct: Buffer.from("tampered").toString("base64")
    };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("rejects wrong key", () => {
    const envelope = encrypt("hello", generateKey());
    expect(() => decrypt(envelope, generateKey())).toThrow();
  });

  it("derives key from passphrase with a per-user salt", () => {
    const salt = generateSalt();
    const key1 = keyFromPassphrase("correct horse battery staple", salt);
    const key2 = keyFromPassphrase("correct horse battery staple", salt);
    expect(key1.equals(key2)).toBe(true);
    const envelope = encrypt("hi", key1);
    expect(decrypt(envelope, key2)).toBe("hi");
  });

  it("produces different keys for the same passphrase with different salts", () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = keyFromPassphrase("same passphrase", salt1);
    const key2 = keyFromPassphrase("same passphrase", salt2);
    expect(key1.equals(key2)).toBe(false);
  });

  it("rejects short salt", () => {
    expect(() => keyFromPassphrase("pass", Buffer.alloc(8))).toThrow(/salt/);
  });

  it("rejects wrong-sized key", () => {
    expect(() => encrypt("hi", Buffer.alloc(16))).toThrow(/32 bytes/);
  });

  it("rejects empty passphrase", () => {
    expect(() => keyFromPassphrase("", generateSalt())).toThrow(/non-empty/);
  });

  it("rejects unsupported envelope version", () => {
    const key = generateKey();
    expect(() => decrypt({ v: 99 as never, alg: "aes-256-gcm", iv: "x", tag: "x", ct: "x" }, key)).toThrow(
      /invalid envelope/
    );
  });

  it("rejects envelope missing required fields", () => {
    const key = generateKey();
    expect(() => decrypt({} as never, key)).toThrow(/invalid envelope/);
    expect(() => decrypt({ v: 1, alg: "aes-256-gcm" } as never, key)).toThrow(/invalid envelope/);
  });

  it("envelopeFromString validates shape", () => {
    expect(() => envelopeFromString("{}")).toThrow(/valid EncryptedEnvelope/);
    expect(() => envelopeFromString("not json")).toThrow();
  });
});

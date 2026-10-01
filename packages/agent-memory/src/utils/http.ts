/**
 * Robust HTTP utilities for provider calls.
 *
 * Features:
 *   - Configurable timeout via AbortController
 *   - Retry with exponential backoff (respects HTTP 429 Retry-After)
 *   - Honours caller-provided AbortSignal
 *   - Surfaces non-retryable errors immediately
 *
 * Designed to be small, dependency-free, and edge-friendly.
 */

import { ProviderError, NetworkError, TimeoutError, AbortError } from "./errors";

export interface RetryPolicy {
  /** Maximum total attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Initial delay between attempts, in ms. Default: 250. */
  initialDelayMs?: number;
  /** Cap on the per-attempt delay, in ms. Default: 5_000. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay between attempts. Default: 2. */
  backoffMultiplier?: number;
  /** HTTP statuses that should be retried. Default: [408, 425, 429, 500, 502, 503, 504]. */
  retryableStatuses?: number[];
  /** Optional jitter — adds random 0..1 * delay to each delay. Default: true. */
  jitter?: boolean;
}

export const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  maxAttempts: 3,
  initialDelayMs: 250,
  maxDelayMs: 5_000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 425, 429, 500, 502, 503, 504],
  jitter: true
};

export interface RequestOptions {
  /** Per-request timeout in ms. 0 or undefined = no timeout. */
  timeoutMs?: number;
  /** External abort signal. Combined with the timeout abort. */
  signal?: AbortSignal;
  /** Optional retry policy. undefined = no retries. */
  retry?: RetryPolicy;
  /** Custom error message prefix (e.g. "OpenAI embeddings"). */
  context?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function computeDelay(attempt: number, policy: Required<RetryPolicy>): number {
  const exponential = policy.initialDelayMs * policy.backoffMultiplier ** attempt;
  const capped = Math.min(exponential, policy.maxDelayMs);
  if (!policy.jitter) return capped;
  return capped * (0.5 + Math.random() * 0.5);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "AbortErrorDOMException");
}

/**
 * POST JSON to a URL and parse the JSON response. Adds retry, timeout, and abort support.
 *
 * @throws {ProviderError} on non-retryable HTTP errors after retries are exhausted
 * @throws {NetworkError} on transport errors (e.g. DNS, connection reset)
 * @throws {TimeoutError} when the request times out
 * @throws {AbortError} when the caller aborts
 */
export async function fetchJSON<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  options: RequestOptions = {}
): Promise<T> {
  const retryPolicy: Required<RetryPolicy> = {
    ...DEFAULT_RETRY_POLICY,
    ...(options.retry ?? {})
  };

  const maxAttempts = Math.max(1, retryPolicy.maxAttempts);
  const context = options.context ? `[agent-memory] ${options.context}: ` : "[agent-memory] ";

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Compose the abort signal: external + (optional) timeout
    const controller = new AbortController();
    const external = options.signal;
    if (external) {
      if (external.aborted) {
        throw new AbortError(`${context}Request aborted before send`);
      }
      external.addEventListener("abort", () => controller.abort(external.reason), { once: true });
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => controller.abort(new TimeoutError(`${context}Request timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      // Try to extract a useful error body
      const text = await response.text().catch(() => "(no body)");
      const err = new ProviderError(
        `${context}HTTP ${response.status} ${response.statusText}: ${text}`,
        response.status,
        { url, body, responseText: text }
      );

      const isRetryable =
        retryPolicy.retryableStatuses.includes(response.status) && attempt < maxAttempts - 1;

      if (isRetryable) {
        // Honour Retry-After if provided
        const retryAfterHeader = response.headers.get("Retry-After");
        let delayMs = computeDelay(attempt, retryPolicy);
        if (retryAfterHeader) {
          const seconds = Number(retryAfterHeader);
          if (!Number.isNaN(seconds) && seconds > 0) {
            delayMs = Math.max(delayMs, seconds * 1000);
          }
        }
        lastError = err;
        await sleep(delayMs);
        continue;
      }

      throw err;
    } catch (err) {
      if (isAbortError(err) || err instanceof AbortError) {
        const reason = (controller.signal as AbortSignal & { reason?: unknown }).reason;
        if (reason instanceof TimeoutError) throw reason;
        throw new AbortError(`${context}Request aborted`);
      }

      // Network-level error (DNS, socket reset, etc.) — retryable
      if (err instanceof ProviderError) throw err;

      const wrapped = new NetworkError(
        `${context}Network error: ${err instanceof Error ? err.message : String(err)}`,
        { url, body, cause: err }
      );
      lastError = wrapped;

      if (attempt < maxAttempts - 1) {
        await sleep(computeDelay(attempt, retryPolicy));
        continue;
      }
      throw wrapped;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  // Should be unreachable — but TS appeasement
  throw lastError instanceof Error ? lastError : new ProviderError(`${context}Request failed`, 0, { url, body });
}

/**
 * GET a URL and parse the JSON response. Same retry/timeout behaviour as fetchJSON.
 */
export async function fetchGetJSON<T>(url: string, headers: Record<string, string> = {}, options: RequestOptions = {}): Promise<T> {
  return fetchJSON<T>(url, undefined as unknown as object, headers, options);
}

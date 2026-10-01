/**
 * Error hierarchy for the agent-memory library.
 *
 * Library consumers can use `instanceof` checks to distinguish error kinds
 * without resorting to message parsing.
 *
 * ```ts
 * try {
 *   await memory.remember(...);
 * } catch (err) {
 *   if (err instanceof EmbeddingError) {
 *     // provider-side or network issue, retryable
 *   } else if (err instanceof StorageError) {
 *     // adapter / persistence issue
 *   } else if (err instanceof ConfigurationError) {
 *     // programmer error — should not retry
 *   }
 * }
 * ```
 */

export interface MemoryErrorContext {
  /** Where the error originated (e.g. "openai.embed", "postgres.search"). */
  source?: string;
  /** Original cause for error chaining. */
  cause?: unknown;
  /** Optional structured context (e.g. SQL state, HTTP status). */
  [key: string]: unknown;
}

/** Base class for all errors thrown by agent-memory. */
export class MemoryError extends Error {
  readonly name: string = "MemoryError";
  readonly context: MemoryErrorContext;

  constructor(message: string, context: MemoryErrorContext = {}) {
    super(message);
    this.context = context;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

/** Thrown when an embedding call fails. */
export class EmbeddingError extends MemoryError {
  readonly name = "EmbeddingError";
}

/** Thrown by provider HTTP calls (after retries are exhausted). */
export class ProviderError extends MemoryError {
  readonly name = "ProviderError";
  /** HTTP status code (if applicable). 0 means transport-level failure. */
  readonly status: number;

  constructor(message: string, status: number = 0, context: MemoryErrorContext = {}) {
    super(message, { ...context, status });
    this.status = status;
  }
}

/** Thrown on transport-level failures (DNS, socket reset, etc.). */
export class NetworkError extends MemoryError {
  readonly name = "NetworkError";
}

/** Thrown when a request times out. */
export class TimeoutError extends MemoryError {
  readonly name = "TimeoutError";
}

/** Thrown when a caller-provided AbortSignal fires. */
export class AbortError extends MemoryError {
  readonly name = "AbortError";
}

/** Thrown when an adapter (storage layer) fails. */
export class StorageError extends MemoryError {
  readonly name = "StorageError";
}

/** Thrown on programmer error — bad options, missing required fields, etc. */
export class ConfigurationError extends MemoryError {
  readonly name = "ConfigurationError";
}

/** Type guard — true for any memory-library error. */
export function isMemoryError(err: unknown): err is MemoryError {
  return err instanceof MemoryError;
}

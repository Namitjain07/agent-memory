/**
 * AES-256-GCM encryption helpers for at-rest protection of memory items.
 *
 * Uses Node's built-in `crypto` module — zero external dependencies.
 *
 * Encrypted payloads are self-describing JSON envelopes:
 *
 * ```json
 * { "v": 1, "alg": "aes-256-gcm", "iv": "<base64>", "tag": "<base64>", "ct": "<base64>" }
 * ```
 *
 * Key material can come from:
 *   - a `Buffer` of 32 random bytes (the recommended path)
 *   - a passphrase, expanded via scrypt to 32 bytes (with a fixed salt for now)
 *
 * @example
 * ```ts
 * import { generateKey, encrypt, decrypt } from "@namitjain.india/agent-memory";
 *
 * const key = generateKey();
 * const envelope = encrypt("the user's SSN is 123-45-6789", key);
 * const plaintext = decrypt(envelope, key);
 * ```
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  type CipherGCM,
  type DecipherGCM
} from "node:crypto";

export interface EncryptedEnvelope {
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ct: string;
}

const VERSION = 1 as const;
const ALG = "aes-256-gcm" as const;
const MIN_SALT_BYTES = 16;

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === VERSION &&
    v.alg === ALG &&
    typeof v.iv === "string" &&
    typeof v.tag === "string" &&
    typeof v.ct === "string"
  );
}

/** Generate a fresh 32-byte AES-256 key. */
export function generateKey(): Buffer {
  return randomBytes(32);
}

/**
 * Generate a fresh scrypt salt of at least 16 bytes. Callers are encouraged
 * to store the salt alongside the encrypted envelope (or per-user / per-tenant)
 * so that the same passphrase can be recovered across processes.
 */
export function generateSalt(bytes: number = MIN_SALT_BYTES): Buffer {
  if (bytes < MIN_SALT_BYTES) {
    throw new Error(`[agent-memory] salt must be at least ${MIN_SALT_BYTES} bytes (got ${bytes})`);
  }
  return randomBytes(bytes);
}

/**
 * Derive a 32-byte key from a passphrase using scrypt with a per-user salt.
 *
 * @param passphrase  User-supplied passphrase
 * @param salt        Salt — at least 16 random bytes. Pass a unique salt per user
 *                    in production (use {@link generateSalt} to create one).
 */
export function keyFromPassphrase(passphrase: string, salt: Buffer | string): Buffer {
  if (!passphrase || passphrase.length === 0) {
    throw new Error("[agent-memory] passphrase must be non-empty");
  }
  const saltBuf = typeof salt === "string" ? Buffer.from(salt, "base64") : salt;
  if (saltBuf.length < MIN_SALT_BYTES) {
    throw new Error(`[agent-memory] salt must be at least ${MIN_SALT_BYTES} bytes (got ${saltBuf.length})`);
  }
  return scryptSync(passphrase, saltBuf, 32);
}

function ensureKey(key: Buffer | string): Buffer {
  if (typeof key === "string") {
    throw new Error(
      "[agent-memory] string keys are not supported directly; use `keyFromPassphrase(passphrase, salt)` for passphrase-based keys, or pass a 32-byte Buffer"
    );
  }
  if (key.length !== 32) {
    throw new Error(`[agent-memory] encryption key must be 32 bytes (got ${key.length})`);
  }
  return key;
}

/** Encrypt a UTF-8 string with AES-256-GCM. Returns a JSON-serializable envelope. */
export function encrypt(plaintext: string, key: Buffer | string): EncryptedEnvelope {
  const keyBuf = ensureKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv) as CipherGCM;
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: VERSION,
    alg: ALG,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ciphertext.toString("base64")
  };
}

/** Decrypt an envelope back to a UTF-8 string. Throws on tampering or invalid shape. */
export function decrypt(envelope: unknown, key: Buffer | string): string {
  if (!isEncryptedEnvelope(envelope)) {
    throw new Error(
      `[agent-memory] invalid envelope shape (v=${(envelope as { v?: unknown })?.v}, alg=${(envelope as { alg?: unknown })?.alg})`
    );
  }
  const keyBuf = ensureKey(key);
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ct = Buffer.from(envelope.ct, "base64");
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv) as DecipherGCM;
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Helper: serialise an envelope to a compact string for storage in TEXT columns. */
export function envelopeToString(envelope: EncryptedEnvelope): string {
  return JSON.stringify(envelope);
}

/** Helper: parse a previously serialised envelope back into the typed object. Throws on invalid shape. */
export function envelopeFromString(serialised: string): EncryptedEnvelope {
  const parsed = JSON.parse(serialised) as unknown;
  if (!isEncryptedEnvelope(parsed)) {
    throw new Error("[agent-memory] envelopeFromString: input is not a valid EncryptedEnvelope");
  }
  return parsed;
}

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
const SCRYPT_SALT = "agent-memory:v1:encryption"; // Static salt — caller can override for production

/** Generate a fresh 32-byte AES-256 key. */
export function generateKey(): Buffer {
  return randomBytes(32);
}

/**
 * Derive a 32-byte key from a passphrase using scrypt.
 *
 * @param passphrase   User-supplied passphrase
 * @param salt         Optional salt; defaults to a fixed app-level salt.
 *                     Pass a unique salt per user in production.
 */
export function keyFromPassphrase(passphrase: string, salt: string = SCRYPT_SALT): Buffer {
  if (!passphrase || passphrase.length === 0) {
    throw new Error("[agent-memory] passphrase must be non-empty");
  }
  return scryptSync(passphrase, salt, 32);
}

function ensureKey(key: Buffer | string): Buffer {
  if (typeof key === "string") return keyFromPassphrase(key);
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

/** Decrypt an envelope back to a UTF-8 string. Throws on tampering. */
export function decrypt(envelope: EncryptedEnvelope, key: Buffer | string): string {
  if (envelope.v !== VERSION || envelope.alg !== ALG) {
    throw new Error(`[agent-memory] unsupported envelope (v=${envelope.v}, alg=${envelope.alg})`);
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

/** Helper: parse a previously serialised envelope back into the typed object. */
export function envelopeFromString(serialised: string): EncryptedEnvelope {
  const parsed = JSON.parse(serialised) as EncryptedEnvelope;
  return parsed;
}

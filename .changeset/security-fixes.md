---
"agent-memory": patch
---

Security and CI fixes (round 3):

**Encryption (security):**

- Removed the static scrypt salt. `keyFromPassphrase` now requires a per-user
  salt of at least 16 bytes (use the new `generateSalt()` helper). This was
  flagged by CodeQL as a high-severity vulnerability — a static salt makes
  scrypt-derived keys vulnerable to precomputation attacks.
- `encrypt()` and `decrypt()` no longer accept a string key directly — they
  require a 32-byte Buffer. Passphrase users must now go through
  `keyFromPassphrase(passphrase, salt)` explicitly. This forces callers to
  think about salt management.

**PII redaction (security):**

- Tightened the phone regex to require a `+` prefix or 10+ digits. The
  previous pattern (`\+?\d[\d\s().-]{6,14}\d`) matched SSN and IPv4 patterns,
  causing false positives that hid other detections.
- Bounded the credit-card regex to prevent ReDoS via repeated unbounded
  quantifiers on adversarial input.

**CI fixes:**

- Build packages before running tests in every CI workflow (the `test` job
  was failing because peer deps like `@namitjain.india/agent-memory-sqlite`
  couldn't resolve their core peer dep until it was built).
- Removed `--reporter=basic` from the bench command (vitest doesn't ship a
  `basic` reporter; use `--reporter=default`).
- Added a separate `build` job so test failures don't hide build failures.
- Added a `concurrency` block to cancel in-progress runs on the same PR.
- Added `timeout-minutes` to every job.
- Added `persist-credentials: false` to all checkout steps.
- Added ESLint to the publish workflow so releases are gated on lint.

**TypeScript:**

- Removed `rootDir: "src"` from every package tsconfig — was excluding tests
  and causing `TS6059: file ... is not under rootDir` errors.
- Fixed two type errors in `multi-tier.test.ts` (over-engineered type
  inference) and `cli/adapters.ts` (narrow `as` casts).

**Formatting:**

- Ran Prettier with `--write` across the repo (was 65 files out of compliance).

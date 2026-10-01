# Security Policy

## Supported versions

| Version | Supported              |
| ------- | ---------------------- |
| 0.5.x   | ✅ Active              |
| 0.4.x   | ⚠️ Critical fixes only |
| 0.3.x   | ❌ End of life         |
| < 0.3   | ❌ End of life         |

## Reporting a vulnerability

**Please do not file a public GitHub issue for security bugs.**

Instead, report privately via one of:

- **GitHub Security Advisories**: https://github.com/Namitjain07/agent-memory/security/advisories/new
- **Email**: jnamit684@gmail.com (PGP key on request)

You should receive an acknowledgement within 48 hours. If you do not, please follow up via the same channel.

## What to include

When reporting, please include:

1. **Description** of the vulnerability.
2. **Steps to reproduce** — minimal code snippet or commands.
3. **Affected versions**.
4. **Impact assessment** — what an attacker could achieve.
5. **Optional**: a suggested fix (we'll review and credit you).

## Disclosure timeline

We follow a coordinated disclosure model:

- **Day 0**: You report the issue privately.
- **Day 1-7**: Triage, impact assessment, fix development.
- **Day 7-30**: Patch release, embargoed notification to major downstream users.
- **Day 30**: Public disclosure via GitHub Security Advisory + a release with the fix.
- **Day 30+**: CVE assignment if applicable (via GitHub Security Advisory).

If you need an extension to the embargo window (e.g. for a coordinated release), let us know in your initial report.

## Scope

In-scope issues include:

- Code execution via crafted inputs to `remember()`, `recall()`, or any adapter
- Memory disclosure / cross-tenant data leaks
- Encryption bypass (e.g. tampered envelopes that decrypt)
- Timing attacks on embedding similarity scoring
- PII redaction bypass
- Anything that breaks the memory graph invariants in `MemoryGraph`

Out-of-scope:

- Denial of service via large inputs (rate limiting is the operator's responsibility)
- Vulnerabilities in dependencies that are already fixed in our pinned ranges
- Issues that require physical access to the operator's machine

## Security best practices for users

When using `agent-memory`:

1. **Always set an encryption key** in production (pass via `encryption.key` or `encryption.passphrase`). The default config stores data in plaintext.
2. **Enable PII redaction** with `pii: { enabled: true }` if your users' data flows through.
3. **Use scoped queries** (`tier`, `userId`, `agentId`) — never let one tenant's `recall()` see another tenant's items.
4. **Keep `peerDependencies` aligned** with the version you're testing against — the core's `peerDependency` is the contract.
5. **Run `npm audit`** in your CI. The repo pins patched versions of all transitive deps.

## Hall of fame

Thanks to the security researchers who have helped make `agent-memory` safer (alphabetical):

- _Your name here — be the first._

## Contact

Maintainer: Namit Jain · https://github.com/Namitjain07

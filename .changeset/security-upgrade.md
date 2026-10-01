---
"agent-memory": patch
"agent-memory-sqlite": patch
"agent-memory-postgres": patch
"agent-memory-react": patch
"agent-memory-vercel": patch
"agent-memory-cli": patch
---

chore(deps): upgrade vulnerable dev dependencies

Closed Dependabot advisories:

- **CRITICAL**: Vitest UI server arbitrary file read (GHSA-9crc-q9x8-hgqq)
  - vitest: 3.2.4 -> 5.0.3
  - @vitest/mocker: 3.2.4 -> 5.0.3
- **HIGH**: vite server.fs.deny bypass on Windows alternate paths (GHSA-93q4-gj69-4c87)
  - vite: 7.0.0+ (now direct devDep, was transitive)
- **HIGH**: PostCSS sourceMappingURL arbitrary file read (GHSA-5669-3x7w-cjgf, GHSA-6g55-p6wh-862q)
  - postcss: 8.5.10 -> 8.5.28 (via npm override)
- **HIGH**: nanoid integer overflow / non-secure generators (GHSA-mwcw-c2x6-8c57, GHSA-374m-jq99-pfg4)
  - nanoid: 3.3.11 -> 5.1.5 (via npm override)
- **MODERATE**: Vitest path traversal via @vitest/mocker redirect mock (GHSA-82fw-gwwq-j7x9)
  - covered by vitest 5 upgrade
- **MODERATE**: launch-editor NTLMv2 hash disclosure (GHSA-7p77-2qgr-3w3p)
  - covered by vite upgrade
- **LOW**: esbuild arbitrary file read on Windows dev server (GHSA-g7r4-m6w7-qqqr)
  - esbuild: 0.27.7 -> 0.28.2 (via npm override)
- **LOW**: Vercel AI SDK filetype bypass (GHSA-92xm-5q7c-3p28)
  - update `ai` in examples/chatbot when convenient; not in the published monorepo

All 153 tests pass with the new versions. No source-code changes required.

Verified: `npm audit` reports 0 vulnerabilities.

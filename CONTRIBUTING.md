# Contributing to Agent Memory

Thanks for your interest in improving Agent Memory!

## Before You Start

1. Search existing [issues](https://github.com/Namitjain07/agent-memory/issues) and [pull requests](https://github.com/Namitjain07/agent-memory/pulls) to avoid duplicate work.
2. For significant changes, open an issue first to discuss scope and design.
3. Keep pull requests focused — one logical change per PR.

---

## Development Setup

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory
npm install        # installs all workspace packages
npm test           # run all unit tests (vitest)
npm run build      # build all packages (tsup)
```

### Integration Tests (requires an API key)

```bash
# Set your NVIDIA NIM key (or any OpenAI-compatible key) as an env var:
$env:NVIDIA_API_KEY = "your-key-here"          # PowerShell
export NVIDIA_API_KEY="your-key-here"          # bash/zsh

node packages/agent-memory/tests/integration-nvidia.mjs
```

---

## Project Structure

```
packages/
  agent-memory/           → core engine, in-memory adapter, withMemory middleware
    src/
      core/               → AgentMemory class
      adapters/           → InMemoryAdapter
      middleware/         → withMemory
      types/              → TypeScript interfaces
      utils/              → math, format, ids, time, tokens, embed-helpers
    tests/                → vitest unit tests + integration scripts
  agent-memory-sqlite/    → SQLiteAdapter
  agent-memory-postgres/  → PostgresAdapter
  agent-memory-react/     → useMemory React hook
```

---

## Contribution Standards

- **TypeScript** — follow existing code style; avoid `any` and unsafe casts.
- **Strong typing** — preserve and expand types wherever possible.
- **Tests** — add or update tests for all behaviour changes.
- **Docs** — update relevant README and CHANGELOG when public APIs change.
- **Adapter compatibility** — all adapters must implement the `MemoryAdapter` interface.

---

## Commit Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add filter callback to RecallOptions
fix: recall no longer throws when no embed fn is configured
docs: add NVIDIA NIM example to README
chore: bump all packages to 0.2.0
test: add stats() and clear() test coverage
refactor: replace index-based InMemoryAdapter with stable Map
```

---

## Pull Request Checklist

- [ ] `npm test` passes locally
- [ ] `npm run build` succeeds
- [ ] New behaviour is covered by tests
- [ ] Docs / README updated if public API changed
- [ ] CHANGELOG entry added under the next version
- [ ] Backward compatibility considered (note breaking changes explicitly)

---

## Reporting Bugs

Use the bug report issue template and include:

- OS, Node.js version, npm version
- Package name + version
- Minimal reproduction
- Expected vs actual behaviour

---

## Security Issues

**Do not open public issues for vulnerabilities.**
Follow [SECURITY.md](./SECURITY.md).

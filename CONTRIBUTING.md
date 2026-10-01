# Contributing

Thanks for your interest in improving `agent-memory`! This document covers how to set up the project locally, run tests, and submit a pull request.

## Development setup

### Prerequisites

- Node.js 18.20+ or 20.x or 22.x
- npm 9+

### First-time setup

```bash
git clone https://github.com/Namitjain07/agent-memory.git
cd agent-memory
npm install --legacy-peer-deps
npm test
npm run build
```

### Why `--legacy-peer-deps`?

This monorepo uses a mix of stable and beta versions across packages (e.g. the `agent-memory` core is stable 0.x, while `agent-memory-cli` is 0.5.0-beta). When the core upgrades its peer dep range, npm's strict resolver sometimes rejects transitive installs. `--legacy-peer-deps` opts back into npm v6 behavior, which is permissive enough to handle our version skew. Consumers using plain `npm install` are not affected.

## Project layout

```
agent-memory/
├── packages/
│   ├── agent-memory/          ← core engine, zero runtime deps
│   ├── agent-memory-sqlite/   ← SQLite adapter
│   ├── agent-memory-postgres/ ← pgvector adapter
│   ├── agent-memory-react/    ← React hook
│   ├── agent-memory-vercel/   ← Vercel AI SDK adapter
│   └── agent-memory-cli/      ← CLI binary
├── examples/                  ← runnable TS demos
├── benchmarks/                ← recall benchmark suite
└── docs/                      ← architecture + comparison docs
```

## Workflow

### 1. Pick an issue

Browse [open issues](https://github.com/Namitjain07/agent-memory/issues) and pick one tagged `good first issue` or `help wanted`. Comment on the issue to claim it before starting work.

### 2. Branch off `main`

```bash
git checkout main
git pull
git checkout -b feat/<short-description>
# or: fix/<short-description>, docs/<short-description>
```

### 3. Make your change

- Follow the existing code style (Prettier + ESLint are configured at the repo root).
- Add tests for any new functionality. Bug fixes should add a regression test.
- Update the relevant package's `CHANGELOG.md` and add a changeset (see below).

### 4. Add a changeset

This repo uses [Changesets](https://github.com/changesets/changesets) for release notes.

```bash
npx changeset
```

This will prompt you for:

- **Which packages changed?** (select from the list)
- **What kind of change?** (major / minor / patch)
- **One-line summary** (will appear in CHANGELOG.md)

It writes a Markdown file under `.changeset/` describing your change. Commit this file with your PR.

### 5. Run the full check suite locally

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four must pass before you open a PR.

### 6. Open a pull request

```bash
git push -u origin feat/<short-description>
```

Then open a PR against `main`. Fill in the PR template. The PR will trigger the CI matrix (lint, typecheck, test, build across Node 18/20/22).

## Coding conventions

- **TypeScript**: strict mode + `exactOptionalPropertyTypes`. No `any` in public APIs.
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes/types, `UPPER_SNAKE_CASE` for env-var style constants.
- **No runtime deps in core.** If you need a new dependency in `packages/agent-memory/src/`, justify it in the PR description and consider an opt-in pattern instead.
- **Prettier**: trailing comma off, single quotes, 100-char line width. Configured in `.prettierrc.json`.
- **Comments**: explain _why_, not _what_. The code should speak for itself.

## Testing conventions

- Use `vitest`. Tests live next to source as `*.test.ts`.
- One `describe` per module, one `it` per behavior.
- Prefer asserting on observable behavior, not internal state.
- For adapters, include both happy path and at least one error path.

## Releasing

Maintainers only:

```bash
npx changeset version   # bumps versions, updates CHANGELOG.md
npx changeset publish   # builds + publishes to npm
git push --follow-tags
```

## Communication

- **Bug reports**: GitHub issues with the `bug` template.
- **Feature requests**: GitHub issues with the `feature` template.
- **Security issues**: see `SECURITY.md` — please do not file public issues for security bugs.
- **General questions**: GitHub Discussions (coming soon) or open an issue with the `question` label.

## License

By contributing, you agree that your contributions will be licensed under the MIT License. See `LICENSE` for details.

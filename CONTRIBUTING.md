# Contributing to Agent Memory

Thanks for your interest in improving Agent Memory.

## Before You Start

1. Search existing issues and pull requests to avoid duplicate work.
2. For significant changes, open an issue first to discuss scope and design.
3. Keep pull requests focused and small where possible.

## Development Setup

```bash
npm install
npm test
npm run build
```

## Project Structure

```txt
packages/
  agent-memory
  agent-memory-sqlite
  agent-memory-postgres
  agent-memory-react
```

## Contribution Standards

- Use TypeScript and follow existing code style/patterns.
- Preserve strong typing; avoid unsafe casts.
- Add or update tests for behavior changes.
- Update docs when public APIs or behavior changes.
- Keep adapter interfaces compatible with core abstractions.

## Commit and PR Guidelines

- Use clear, descriptive commit messages.
- Link related issues in PR description.
- Include:
  - what changed
  - why it changed
  - any migration/usage notes

## Pull Request Checklist

- [ ] Tests pass locally
- [ ] Build succeeds locally
- [ ] Documentation updated (if needed)
- [ ] Backward compatibility considered

## Reporting Bugs

Use the bug report issue template and include:

- environment (OS, Node, npm)
- package/version
- minimal reproduction
- expected vs actual behavior

## Security Issues

Do not open public issues for vulnerabilities.
Please follow [SECURITY.md](./SECURITY.md).

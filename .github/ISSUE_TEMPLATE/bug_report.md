---
name: Bug report
about: Something is broken or behaving incorrectly
title: "[bug] "
labels: ["bug", "needs-triage"]
assignees: []
---

## Describe the bug

A clear and concise description of what the bug is.

## To reproduce

Minimal reproduction — ideally a code snippet or a link to a repo.

```ts
import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";

// your reproduction here
```

## Expected behaviour

What you expected to happen.

## Actual behaviour

What actually happens. Include any error messages, stack traces, or unexpected output.

```
<error message>
```

## Environment

- **Package version(s)**: e.g. `@namitjain.india/agent-memory@0.5.0`
- **Node version**: `node -v`
- **OS**: macOS / Linux / Windows
- **Storage adapter**: in-memory / SQLite / Postgres
- **Provider(s)**: openai / anthropic / ollama / ...
- **Other relevant context**: framework versions, etc.

## Checklist

- [ ] I searched [existing issues](https://github.com/Namitjain07/agent-memory/issues) for this bug
- [ ] I read the [package README](https://github.com/Namitjain07/agent-memory/tree/main/packages) for the affected package
- [ ] I tried the latest published version
- [ ] I have a minimal reproduction

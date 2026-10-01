# @namitjain.india/agent-memory-cli

Inspect, search, and manage agent-memory stores from the command line.

```bash
npm install -g @namitjain.india/agent-memory-cli
```

## Usage

```bash
# List all memory items in a database
agent-memory --db ./memory.db list

# List items for a specific session
agent-memory --db ./memory.db --session user-123 list

# Search for items matching a query
agent-memory --db ./memory.db --session user-123 search TypeScript

# Show a specific item
agent-memory --db ./memory.db show mem_abc123

# Get aggregate stats
agent-memory --db ./memory.db stats

# Export to JSON
agent-memory --db ./memory.db --format json export > memory.json
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `list` | `ls` | List all memory items (optionally `--session`) |
| `search <query>` | `s` | Keyword search across content, key, value |
| `show <id>` | | Show full details for a memory item |
| `stats` | | Aggregate counts by kind, tier, and session |
| `forget <id>` | `rm` | Show how to delete a memory item |
| `clear` | | Show how to clear a session (requires `--session`) |
| `export` | | Export items as JSON (without embeddings) |
| `help` | `-h`, `--help` | Print help |
| `version` | `-v`, `--version` | Print version |

## Output formats

Use `--format` to choose:

- `table` (default) — pretty-printed table for humans
- `json` — machine-readable JSON
- `tsv` — tab-separated values, one row per item

Or use the shortcuts `--json` and `--tsv`.

## Why is the CLI read-only?

Reading the database is safe with a read-only connection. Deleting items
should go through the library so it stays consistent with application-level
caches and locks. The `forget` and `clear` commands print the exact Node
snippet to run, so you can paste it into your app or a one-off script.

## License

MIT

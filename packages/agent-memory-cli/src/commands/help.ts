import type { CommandContext, CommandResult } from "../index.js";

const HELP = `
agent-memory CLI — inspect and manage agent-memory stores

USAGE
  agent-memory [global options] <command> [command args]

GLOBAL OPTIONS
  -d, --db <path>         Path to a SQLite database file (default: ./agent-memory.db)
  -s, --session <id>      Scope commands to a specific session
  -f, --format <fmt>      Output format: table | json | tsv (default: table)
      --json              Shorthand for --format=json
      --tsv               Shorthand for --format=tsv
  -v, --version           Print the CLI version
  -h, --help              Print this help

COMMANDS
  list, ls                List all memory items (optionally --session)
  search, s <query>       Keyword search across content, key, value
  show <id>               Show full details for a memory item
  stats                   Print aggregate counts (by kind, by tier, by session)
  forget, rm <id>         Show how to delete a memory item (CLI is read-only)
  clear                   Show how to clear a session (requires --session)
  export                  Export items as JSON (without embeddings)
  help, -h, --help        Print this help
  version, -v, --version  Print version

EXAMPLES
  # List all items
  agent-memory --db ./mem.db list

  # Search for facts about TypeScript in session "user-1"
  agent-memory --db ./mem.db --session user-1 search TypeScript

  # Export everything to JSON
  agent-memory --db ./mem.db --format json export > memory.json
`;

export async function cmdHelp(ctx: CommandContext): Promise<CommandResult> {
  ctx.stdout.write(HELP);
  return { exitCode: 0 };
}

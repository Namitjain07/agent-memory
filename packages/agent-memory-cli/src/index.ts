/**
 * agent-memory CLI library — used by the `bin/agent-memory` script.
 *
 * Exposes `run(argv)` which dispatches to the relevant subcommand.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openSqlite } from "./adapters.js";
import { cmdList } from "./commands/list.js";
import { cmdSearch } from "./commands/search.js";
import { cmdShow } from "./commands/show.js";
import { cmdStats } from "./commands/stats.js";
import { cmdForget } from "./commands/forget.js";
import { cmdClear } from "./commands/clear.js";
import { cmdExport } from "./commands/export.js";
import { cmdHelp } from "./commands/help.js";

export interface GlobalOptions {
  /** Path to a SQLite database file. */
  db?: string;
  /** Session id to scope commands to. */
  session?: string;
  /** Output format. */
  format?: "table" | "json" | "tsv";
}

export interface CommandContext {
  options: GlobalOptions;
  args: string[];
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

export interface CommandResult {
  exitCode: number;
}

const SUBCOMMANDS = new Set([
  "list",
  "ls",
  "search",
  "s",
  "show",
  "stats",
  "forget",
  "rm",
  "clear",
  "export",
  "help",
  "--help",
  "-h",
  "version",
  "--version",
  "-v"
]);

export async function run(
  argv: string[],
  overrideStreams?: { stdout?: NodeJS.WritableStream; stderr?: NodeJS.WritableStream }
): Promise<CommandResult> {
  const stdout = overrideStreams?.stdout ?? process.stdout;
  const stderr = overrideStreams?.stderr ?? process.stderr;

  if (argv.length === 0) {
    await cmdHelp({ options: {}, args: [], stdout, stderr });
    return { exitCode: 0 };
  }

  // Parse global options (--db, --session, --format)
  const globalOptions: GlobalOptions = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--db" || arg === "-d") {
      const v = argv[++i];
      if (v) globalOptions.db = v;
    } else if (arg.startsWith("--db=")) {
      globalOptions.db = arg.slice("--db=".length);
    } else if (arg === "--session" || arg === "-s") {
      const v = argv[++i];
      if (v) globalOptions.session = v;
    } else if (arg.startsWith("--session=")) {
      globalOptions.session = arg.slice("--session=".length);
    } else if (arg === "--format" || arg === "-f") {
      const v = argv[++i];
      if (v === "table" || v === "json" || v === "tsv") globalOptions.format = v;
    } else if (arg === "--json") {
      globalOptions.format = "json";
    } else if (arg === "--tsv") {
      globalOptions.format = "tsv";
    } else if (SUBCOMMANDS.has(arg)) {
      positional.push(arg);
    } else {
      positional.push(arg);
    }
  }

  const sub = positional[0] ?? "list";
  const args = positional.slice(1);

  if (sub === "help" || sub === "--help" || sub === "-h") {
    await cmdHelp({ options: globalOptions, args, stdout, stderr });
    return { exitCode: 0 };
  }
  if (sub === "version" || sub === "--version" || sub === "-v") {
    stdout.write("agent-memory CLI v0.1.0\n");
    return { exitCode: 0 };
  }

  // Resolve db path
  const dbPath = resolve(globalOptions.db ?? "./agent-memory.db");
  if (!existsSync(dbPath) && sub !== "help") {
    stderr.write(`[agent-memory] Database file not found: ${dbPath}\n`);
    stderr.write(
      `[agent-memory] Create one with the @namitjain.india/agent-memory-sqlite adapter, or pass --db to point at an existing file.\n`
    );
    return { exitCode: 1 };
  }

  const ctx: CommandContext = { options: globalOptions, args, stdout, stderr };

  try {
    switch (sub) {
      case "list":
      case "ls":
        return await cmdList(openSqlite(dbPath), ctx);
      case "search":
      case "s":
        return await cmdSearch(openSqlite(dbPath), ctx);
      case "show":
        return await cmdShow(openSqlite(dbPath), ctx);
      case "stats":
        return await cmdStats(openSqlite(dbPath), ctx);
      case "forget":
      case "rm":
        return await cmdForget(openSqlite(dbPath), ctx);
      case "clear":
        return await cmdClear(openSqlite(dbPath), ctx);
      case "export":
        return await cmdExport(openSqlite(dbPath), ctx);
      default:
        stderr.write(`Unknown command: ${sub}\n`);
        await cmdHelp({ options: globalOptions, args, stdout, stderr });
        return { exitCode: 2 };
    }
  } finally {
    // No-op: adapters handle their own cleanup
  }
}

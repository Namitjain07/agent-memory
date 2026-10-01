import type { CommandContext, CommandResult } from "../index.js";
import type { SQLiteHandle } from "../adapters.js";

export async function cmdClear(handle: SQLiteHandle, ctx: CommandContext): Promise<CommandResult> {
  const session = ctx.options.session;
  if (!session) {
    ctx.stderr.write("Usage: agent-memory clear --session <id>\n");
    handle.close();
    return { exitCode: 2 };
  }
  ctx.stderr.write(
    `[agent-memory] The CLI is read-only. To clear all items in session '${session}', run:\n` +
      `  import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";\n` +
      `  const a = new SQLiteAdapter({ dbPath: "${ctx.options.db ?? "./agent-memory.db"}" });\n` +
      `  await a.clear("${session}");\n`
  );
  handle.close();
  return { exitCode: 0 };
}

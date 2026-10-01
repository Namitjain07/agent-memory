import { selectById, type SQLiteHandle } from "../adapters.js";
import type { CommandContext, CommandResult } from "../index.js";

/** Forget closes the read-only handle and instructs the user to delete. */
export async function cmdForget(handle: SQLiteHandle, ctx: CommandContext): Promise<CommandResult> {
  const id = ctx.args[0];
  if (!id) {
    ctx.stderr.write("Usage: agent-memory forget <id>\n");
    handle.close();
    return { exitCode: 2 };
  }
  const item = selectById(handle, id);
  if (!item) {
    ctx.stderr.write(`No memory item with id '${id}'\n`);
    handle.close();
    return { exitCode: 1 };
  }
  ctx.stderr.write(
    `[agent-memory] The CLI is read-only. To delete this item, run a Node script:\n` +
      `  import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";\n` +
      `  const a = new SQLiteAdapter({ dbPath: "${ctx.options.db ?? "./agent-memory.db"}" });\n` +
      `  await a.delete("${id}");\n`
  );
  handle.close();
  return { exitCode: 0 };
}

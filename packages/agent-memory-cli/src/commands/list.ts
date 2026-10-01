import { selectAll, type SqliteMemoryItem, type SQLiteHandle } from "../adapters.js";
import { formatOutput } from "../format.js";
import type { CommandContext, CommandResult } from "../index.js";

export async function cmdList(handle: SQLiteHandle, ctx: CommandContext): Promise<CommandResult> {
  const items = selectAll(handle, ctx.options.session);
  ctx.stdout.write(formatOutput(items, ctx.options.format) + "\n");
  void ([] as SqliteMemoryItem[]);
  return { exitCode: 0 };
}

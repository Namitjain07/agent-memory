import { selectById, type SQLiteHandle } from "../adapters.js";
import { formatSingle } from "../format.js";
import type { CommandContext, CommandResult } from "../index.js";

export async function cmdShow(handle: SQLiteHandle, ctx: CommandContext): Promise<CommandResult> {
  const id = ctx.args[0];
  if (!id) {
    ctx.stderr.write("Usage: agent-memory show <id>\n");
    return { exitCode: 2 };
  }
  const item = selectById(handle, id);
  if (!item) {
    ctx.stderr.write(`No memory item with id '${id}'\n`);
    return { exitCode: 1 };
  }
  ctx.stdout.write(formatSingle(item, ctx.options.format) + "\n");
  return { exitCode: 0 };
}

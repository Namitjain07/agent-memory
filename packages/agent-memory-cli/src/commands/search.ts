import { searchLike, type SQLiteHandle } from "../adapters.js";
import { formatOutput } from "../format.js";
import type { CommandContext, CommandResult } from "../index.js";

export async function cmdSearch(handle: SQLiteHandle, ctx: CommandContext): Promise<CommandResult> {
  const query = ctx.args.join(" ").trim();
  if (!query) {
    ctx.stderr.write("Usage: agent-memory search <query>\n");
    return { exitCode: 2 };
  }
  const items = searchLike(handle, query, ctx.options.session);
  ctx.stdout.write(formatOutput(items, ctx.options.format) + "\n");
  return { exitCode: 0 };
}

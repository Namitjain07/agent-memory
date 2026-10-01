import { stats as statsQuery, type SQLiteHandle } from "../adapters.js";
import type { CommandContext, CommandResult } from "../index.js";

export async function cmdStats(handle: SQLiteHandle, ctx: CommandContext): Promise<CommandResult> {
  const s = statsQuery(handle, ctx.options.session);
  if (ctx.options.format === "json") {
    ctx.stdout.write(JSON.stringify(s, null, 2) + "\n");
  } else {
    const lines = [
      `Total:      ${s.total}`,
      `By kind:    ${
        Object.entries(s.byKind)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ") || "(none)"
      }`,
      `By tier:    ${
        Object.entries(s.byTier)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ") || "(none)"
      }`,
      `Sessions:   ${s.sessions}`,
      `Users:      ${s.users}`,
      `Agents:     ${s.agents}`
    ];
    ctx.stdout.write(lines.join("\n") + "\n");
  }
  handle.close();
  return { exitCode: 0 };
}

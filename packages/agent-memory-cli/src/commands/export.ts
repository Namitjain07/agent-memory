import { selectAll, type SQLiteHandle, type SqliteMemoryItem } from "../adapters.js";
import type { CommandContext, CommandResult } from "../index.js";

export async function cmdExport(handle: SQLiteHandle, ctx: CommandContext): Promise<CommandResult> {
  const items = selectAll(handle, ctx.options.session);
  const out = items.map(stripEmbedding);
  ctx.stdout.write(JSON.stringify(out, null, 2) + "\n");
  return { exitCode: 0 };
}

function stripEmbedding(item: SqliteMemoryItem): Record<string, unknown> {
  return {
    id: item.id,
    kind: item.kind,
    sessionId: item.session_id,
    tier: item.tier ?? "session",
    userId: item.user_id,
    agentId: item.agent_id,
    timestamp: item.timestamp,
    importance: item.importance,
    role: item.role,
    content: item.content,
    key: item.key_name,
    value: item.value_text,
    fromTimestamp: item.from_timestamp,
    toTimestamp: item.to_timestamp,
    metadata: item.metadata ? JSON.parse(item.metadata) : null
  };
}

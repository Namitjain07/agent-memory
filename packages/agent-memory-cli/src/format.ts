/** Output formatting helpers — table, json, tsv. */

import type { SqliteMemoryItem } from "./adapters.js";

export function formatOutput(items: SqliteMemoryItem[], format: "table" | "json" | "tsv" | undefined): string {
  switch (format ?? "table") {
    case "json":
      return JSON.stringify(items.map(toPublic), null, 2);
    case "tsv":
      return toTsv(items);
    case "table":
    default:
      return toTable(items);
  }
}

export function formatSingle(item: SqliteMemoryItem, format: "table" | "json" | "tsv" | undefined): string {
  switch (format ?? "json") {
    case "table":
    case "tsv":
      return toTable([item]);
    case "json":
    default:
      return JSON.stringify(toPublic(item), null, 2);
  }
}

function toPublic(item: SqliteMemoryItem): Record<string, unknown> {
  const meta = item.metadata ? (JSON.parse(item.metadata) as Record<string, unknown>) : undefined;
  const out: Record<string, unknown> = {
    id: item.id,
    kind: item.kind,
    sessionId: item.session_id,
    tier: item.tier ?? "session",
    timestamp: item.timestamp,
    importance: item.importance
  };
  if (item.user_id) out.userId = item.user_id;
  if (item.agent_id) out.agentId = item.agent_id;
  if (item.content) out.content = item.content;
  if (item.role) out.role = item.role;
  if (item.key_name) out.key = item.key_name;
  if (item.value_text) out.value = item.value_text;
  if (item.from_timestamp) out.fromTimestamp = item.from_timestamp;
  if (item.to_timestamp) out.toTimestamp = item.to_timestamp;
  if (item.replaced_entry_ids) out.replacedEntryIds = JSON.parse(item.replaced_entry_ids);
  if (meta) out.metadata = meta;
  return out;
}

function toTsv(items: SqliteMemoryItem[]): string {
  const header = "id\tkind\ttier\tsessionId\ttimestamp\timportance\tcontent";
  const lines = items.map((i) =>
    [i.id, i.kind, i.tier ?? "session", i.session_id, i.timestamp, i.importance, (i.content ?? "").replace(/\t/g, " ")].join("\t")
  );
  return [header, ...lines].join("\n");
}

function toTable(items: SqliteMemoryItem[]): string {
  if (items.length === 0) return "(no items)";
  const rows = items.map((i) => ({
    id: i.id.slice(0, 12),
    kind: i.kind,
    tier: i.tier ?? "session",
    importance: i.importance.toFixed(2),
    timestamp: new Date(i.timestamp).toISOString().replace("T", " ").slice(0, 19),
    summary: preview(i)
  }));
  const headers = ["id", "kind", "tier", "importance", "timestamp", "summary"] as const;
  const widths = headers.map((h) => Math.max(h.length, ...rows.map((r) => String(r[h]).length)));

  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const headerLine = "|" + headers.map((h, idx) => ` ${h.padEnd(widths[idx]!)} `).join("|") + "|";
  const bodyLines = rows.map(
    (r) =>
      "|" +
      headers
        .map((h, idx) => ` ${String(r[h]).padEnd(widths[idx]!)} `)
        .join("|") +
      "|"
  );

  return [sep, headerLine, sep, ...bodyLines, sep].join("\n");
}

function preview(i: SqliteMemoryItem): string {
  if (i.kind === "fact") return `${i.key_name}: ${i.value_text}`;
  if (i.kind === "summary") return i.content?.slice(0, 80) ?? "";
  return i.content?.slice(0, 80) ?? "";
}

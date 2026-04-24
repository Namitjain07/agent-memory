import type { RecallResult } from "../types/config";
import type { MemoryItem } from "../types/memory";

const DEFAULT_MAX_CONTENT_LENGTH = 220;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function itemLabel(item: MemoryItem): string {
  if (item.kind === "entry") {
    return `entry:${item.role}`;
  }
  if (item.kind === "fact") {
    return `fact:${item.key}`;
  }
  return "summary";
}

export function formatRecallResults(
  results: RecallResult[],
  maxContentLength: number = DEFAULT_MAX_CONTENT_LENGTH
): string {
  if (results.length === 0) {
    return "No relevant prior memory.";
  }

  const lines = results.map((result, index) => {
    const item = result.item;
    const content =
      item.kind === "fact"
        ? `${item.key}=${item.value}`
        : truncate(item.content, maxContentLength);
    return `${index + 1}. [${itemLabel(item)} | score=${result.score.toFixed(3)}] ${content}`;
  });

  return lines.join("\n");
}

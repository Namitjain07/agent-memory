import { clamp } from "./math";

export function recencyScore(
  timestamp: number,
  now: number,
  lambda: number
): number {
  const hoursAgo = Math.max(0, (now - timestamp) / 3_600_000);
  return clamp(Math.exp(-lambda * hoursAgo), 0, 1);
}

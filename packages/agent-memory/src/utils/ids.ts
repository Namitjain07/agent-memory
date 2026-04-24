export function createMemoryId(prefix: string = "mem"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now()}_${random}`;
}

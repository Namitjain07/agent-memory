export function approximateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const wordCount = trimmed.split(/\s+/).length;
  return Math.ceil(wordCount * 1.35);
}

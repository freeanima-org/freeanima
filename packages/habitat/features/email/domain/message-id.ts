/** Normalize RFC Message-ID to angle-bracket form for stable equality. */
export function normalizeRfcMessageId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return `<${trimmed}>`;
}

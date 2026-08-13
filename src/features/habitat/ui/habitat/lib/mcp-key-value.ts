import { coerceString } from "@freeanima/shared/coerce-string";
export function recordToKeyValueText(record: unknown): string {
  if (record == null || typeof record !== "object" || Array.isArray(record)) return "";
  return Object.entries(record as Record<string, unknown>)
    .map(([k, v]) => `${k}=${coerceString(v ?? "")}`)
    .join("\n");
}

export function keyValueTextToRecord(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

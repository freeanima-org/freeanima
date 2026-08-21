import { coerceString } from "@freeanima/shared/coerce-string";
import { asRecord } from "@freeanima/shared/util";
export function recordToKeyValueText(record: unknown): string {
  if (record == null || typeof record !== "object" || Array.isArray(record)) return "";
  return Object.entries(asRecord(record) ?? {})
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

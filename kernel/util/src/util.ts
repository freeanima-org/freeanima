import { readFileSync } from "node:fs";
import type { z } from "zod";

/** Millisecond offset of CST (+8) from UTC */
export const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Current instant as CST ISO 8601 string (+08:00) */
export function formatCstIso(date: Date = new Date()): string {
  return new Date(date.getTime() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

/** Config `enabled` treated as on when absent or true */
export function isEnabledByDefault(cfg: { enabled?: boolean } | undefined): boolean {
  return cfg?.enabled !== false;
}

/** Read JSON file and safeParse; null on failure */
export function parseJsonFile<T extends z.ZodType>(path: string, schema: T): z.infer<T> | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));
    const result = schema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** safeParse unknown input; null on failure */
export function safeParseOrNull<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> | null {
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Format Zod error as short readable string */
export function formatZodError(error: Pick<z.ZodError, "issues">): string {
  const first = error.issues[0];
  if (!first) return "validation failed";
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

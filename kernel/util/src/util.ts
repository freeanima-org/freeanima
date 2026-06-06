import { readFileSync } from "node:fs";
import type { z } from "zod";

/** 东八区相对 UTC 的毫秒偏移 */
export const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 当前时刻的 CST ISO 8601 字符串（+08:00） */
export function formatCstIso(date: Date = new Date()): string {
  return new Date(date.getTime() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

/** JSONL 单行 safeParse；无效行返回 null */
export function parseJsonLine<T extends z.ZodType>(line: string, schema: T): z.infer<T> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const raw: unknown = JSON.parse(trimmed);
    const result = schema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** 读取 JSON 文件并 safeParse；失败返回 null */
export function parseJsonFile<T extends z.ZodType>(path: string, schema: T): z.infer<T> | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));
    const result = schema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** unknown 输入 safeParse；失败返回 null */
export function safeParseOrNull<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> | null {
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

/** 将 Zod 错误格式化为简短可读字符串 */
export function formatZodError(error: Pick<z.ZodError, "issues">): string {
  const first = error.issues[0];
  if (!first) return "validation failed";
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

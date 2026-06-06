/** 展开 Drizzle / postgres 错误，便于 CLI 日志 */
import { formatZodError } from "@freeanima/kernel-util";
import { ZodError } from "zod";

export function formatDbError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [e.message];
  if ("cause" in e && e.cause instanceof Error && e.cause.message) {
    parts.push(`cause: ${e.cause.message}`);
  }
  return parts.join(" | ");
}

/** CLI 展示：优先 PostgreSQL cause，去掉 Drizzle 整段 SQL */
export function shortDbError(e: unknown, maxLen = 160): string {
  if (e instanceof ZodError) {
    return formatZodError(e).slice(0, maxLen);
  }
  if (!(e instanceof Error)) return String(e).slice(0, maxLen);
  if ("cause" in e && e.cause instanceof Error && e.cause.message) {
    return e.cause.message.slice(0, maxLen);
  }
  const msg = e.message;
  const causeTag = "| cause: ";
  const idx = msg.indexOf(causeTag);
  if (idx >= 0) {
    return msg.slice(idx + causeTag.length).slice(0, maxLen);
  }
  if (msg.startsWith("Failed query:")) {
    return "数据库写入失败";
  }
  const firstLine = msg.split("\n")[0] ?? msg;
  return firstLine.slice(0, maxLen);
}

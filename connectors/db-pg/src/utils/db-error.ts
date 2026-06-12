/** Unwrap Drizzle / postgres errors for CLI logging */
import { formatZodError } from "@freeanima/storage-util";
import { ZodError } from "zod";

export function formatDbError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [e.message];
  if ("cause" in e && e.cause instanceof Error && e.cause.message) {
    parts.push(`cause: ${e.cause.message}`);
  }
  return parts.join(" | ");
}

/** CLI display: prefer PostgreSQL cause, strip full Drizzle SQL */
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
    return "Database write failed";
  }
  const firstLine = msg.split("\n")[0] ?? msg;
  return firstLine.slice(0, maxLen);
}

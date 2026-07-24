import type { z } from "zod";

/** safeParse unknown input; null on failure */
export function safeParseOrNull<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> | null {
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Format Zod error as short readable string */
export function formatZodError(error: Pick<z.ZodError, "issues">): string {
  const first = error.issues[0];
  if (!first) return "validation failed";
  const path = first.path.length > 0 ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

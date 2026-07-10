import { z } from "zod";

import { semanticMemoryStatusSchema, semanticMemoryTypeSchema } from "@freeanima/core/db/schema";
import { semanticMemoryRowSchema } from "@freeanima/core/db/pg/semantic-memory/types";

export { semanticMemoryStatusSchema, semanticMemoryTypeSchema };
export type { SemanticMemoryStatus, SemanticMemoryType } from "@freeanima/core/db/schema";

export function normalizeSemanticMemoryType(
  raw: string | undefined | null,
): import("@freeanima/core/db/schema").SemanticMemoryType {
  if (!raw?.trim()) return "world";
  const parsed = semanticMemoryTypeSchema.safeParse(raw.trim().toLowerCase());
  return parsed.success ? parsed.data : "world";
}

export const semanticMemorySchema = semanticMemoryRowSchema.extend({
  type: semanticMemoryTypeSchema,
  status: semanticMemoryStatusSchema,
});

export type SemanticMemory = z.infer<typeof semanticMemorySchema>;

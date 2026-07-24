import { z } from "zod";

export const SEMANTIC_MEMORY_COMPONENT = "semantic_memory" as const;

export const semanticMemoryTypeSchema = z.enum([
  "world",
  "experience",
  "opinion",
  "observation",
  "preference",
  "procedural",
  "imprint",
]);

export type SemanticMemoryType = z.infer<typeof semanticMemoryTypeSchema>;

export const semanticMemoryStatusSchema = z.enum(["active", "deprecated"]);

export type SemanticMemoryStatus = z.infer<typeof semanticMemoryStatusSchema>;

export function normalizeSemanticMemoryType(raw: string | undefined | null): SemanticMemoryType {
  if (!raw?.trim()) return "world";
  const parsed = semanticMemoryTypeSchema.safeParse(raw.trim().toLowerCase());
  return parsed.success ? parsed.data : "world";
}

export const semanticMemoryBodySchema = z.object({
  /** 旧 semantic_memory.type（与 entities.type 区分） */
  memory_kind: semanticMemoryTypeSchema.default("world"),
  status: semanticMemoryStatusSchema.default("active"),
  source_conversations: z.array(z.string()).default([]),
  observed_at: z.string().nullable().optional(),
  occurred_at: z.string().nullable().optional(),
  /** 迁移期保留旧 f-xxx；验证后可弃 */
  legacy_id: z.string().optional(),
});

export type SemanticMemoryBody = z.infer<typeof semanticMemoryBodySchema>;

import { z } from "zod";

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

/** 旧 fact 类型映射为 world */
export function normalizeSemanticMemoryType(raw: string | undefined | null): SemanticMemoryType {
  const t = String(raw ?? "world")
    .trim()
    .toLowerCase();
  if (t === "fact") return "world";
  const parsed = semanticMemoryTypeSchema.safeParse(t);
  return parsed.success ? parsed.data : "world";
}

export const semanticMemorySchema = z.object({
  id: z.string(),
  type: semanticMemoryTypeSchema,
  pinned: z.boolean(),
  content: z.string(),
  source_sessions: z.array(z.string()).default([]),
  observed_at: z.string().nullable().default(null),
  occurred_at: z.string().nullable().default(null),
  status: semanticMemoryStatusSchema.default("active"),
  created: z.string(),
  updated: z.string(),
});

export type SemanticMemory = z.infer<typeof semanticMemorySchema>;

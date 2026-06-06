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

/** 旧 fact 类型及 reflect 产出映射为 world */
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
  created: z.string(),
  updated: z.string(),
});

export type SemanticMemory = z.infer<typeof semanticMemorySchema>;

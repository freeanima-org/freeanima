import { z } from "zod";

export const SEMANTIC_REF_COMPONENT = "semantic_ref" as const;

export const semanticRefBodySchema = z.object({
  semantic_memory_id: z.string().min(1),
});

export type SemanticRefBody = z.infer<typeof semanticRefBodySchema>;

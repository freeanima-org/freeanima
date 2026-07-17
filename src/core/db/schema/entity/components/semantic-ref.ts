import { z } from "zod";

export const SEMANTIC_REF_COMPONENT = "semantic_ref" as const;

export const semanticRefBodySchema = z.object({
  /** entities.id of primary_component=semantic_memory */
  entity_id: z.number().int().positive(),
});

export type SemanticRefBody = z.infer<typeof semanticRefBodySchema>;

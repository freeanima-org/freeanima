import { SEMANTIC_REF_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SEMANTIC_REF_COMPONENT };

import { z } from "zod";

export const semanticRefBodySchema = z.object({
  /** entities.id of primary_component=semantic_memory */
  entity_id: z.number().int().positive(),
});

export type SemanticRefBody = z.infer<typeof semanticRefBodySchema>;

import { LIMBIC_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { LIMBIC_COMPONENT };

import { z } from "zod";

import { limbicKindSchema, type LimbicKind } from "@freeanima/shared/db-shapes";

export { limbicKindSchema, type LimbicKind };

export const limbicBodySchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
  intensity: z.number().min(0).max(1),
  /** provenance（旧 limbic_memory 表字段） */
  kind: limbicKindSchema.optional(),
  conversation_id: z.string().optional(),
  source_segment: z.string().nullable().optional(),
  /** entities.id（primary_component=semantic_memory） */
  semantic_memory_ids: z.array(z.number().int().positive()).default([]).optional(),
  legacy_id: z.string().optional(),
});

export type LimbicBody = z.infer<typeof limbicBodySchema>;

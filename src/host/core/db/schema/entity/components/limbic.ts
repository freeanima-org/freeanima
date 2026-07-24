import { z } from "zod";

export const LIMBIC_COMPONENT = "limbic" as const;

export const limbicKindSchema = z.enum(["conversation_mood", "turning_point", "spike"]);

export type LimbicKind = z.infer<typeof limbicKindSchema>;

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

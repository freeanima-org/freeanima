import { z } from "zod";

export const NARRATIVE_COMPONENT = "narrative" as const;

export const narrativeSignificanceSchema = z.enum(["normal", "milestone", "turning_point"]);

export type NarrativeSignificance = z.infer<typeof narrativeSignificanceSchema>;

/** @deprecated alias — 旧 autobiographical_memory 命名 */
export const autobiographicalSignificanceSchema = narrativeSignificanceSchema;

export const narrativeStatusSchema = z.enum(["active", "deprecated"]);

export type NarrativeStatus = z.infer<typeof narrativeStatusSchema>;

/** @deprecated alias */
export const autobiographicalStatusSchema = narrativeStatusSchema;

export const narrativeBodySchema = z.object({
  significance: narrativeSignificanceSchema.default("normal"),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  source_facts: z.array(z.string()).default([]).optional(),
  source_conversations: z.array(z.string()).default([]).optional(),
  status: narrativeStatusSchema.default("active").optional(),
  legacy_id: z.string().optional(),
});

export type NarrativeBody = z.infer<typeof narrativeBodySchema>;

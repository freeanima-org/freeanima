import { z } from "zod";

import {
  autobiographicalSignificanceSchema,
  autobiographicalStatusSchema,
  narrativeSignificanceSchema,
  narrativeStatusSchema,
  type NarrativeSignificance,
  type NarrativeStatus,
} from "@freeanima/shared/db-shapes";

export {
  narrativeSignificanceSchema,
  autobiographicalSignificanceSchema,
  narrativeStatusSchema,
  autobiographicalStatusSchema,
  type NarrativeSignificance,
  type NarrativeStatus,
};

export const NARRATIVE_COMPONENT = "narrative" as const;

export const narrativeBodySchema = z.object({
  significance: narrativeSignificanceSchema.default("normal"),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  source_facts: z.array(z.number().int().positive()).default([]).optional(),
  source_conversations: z.array(z.string()).default([]).optional(),
  status: narrativeStatusSchema.default("active").optional(),
  legacy_id: z.string().optional(),
});

export type NarrativeBody = z.infer<typeof narrativeBodySchema>;

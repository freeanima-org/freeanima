import { NARRATIVE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { NARRATIVE_COMPONENT };

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

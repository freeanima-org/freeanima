import { z } from "zod";

export const NARRATIVE_COMPONENT = "narrative" as const;

export const narrativeSignificanceSchema = z.enum(["normal", "milestone", "turning_point"]);

export type NarrativeSignificance = z.infer<typeof narrativeSignificanceSchema>;

export const narrativeBodySchema = z.object({
  significance: narrativeSignificanceSchema.default("normal"),
});

export type NarrativeBody = z.infer<typeof narrativeBodySchema>;

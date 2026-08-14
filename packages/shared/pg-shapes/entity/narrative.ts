import { z } from "zod";

export const narrativeSignificanceSchema = z.enum(["normal", "milestone", "turning_point"]);
export type NarrativeSignificance = z.infer<typeof narrativeSignificanceSchema>;

/** @deprecated alias — 旧 autobiographical_memory 命名 */
export const autobiographicalSignificanceSchema = narrativeSignificanceSchema;

export const narrativeStatusSchema = z.enum(["active", "deprecated"]);
export type NarrativeStatus = z.infer<typeof narrativeStatusSchema>;

/** @deprecated alias */
export const autobiographicalStatusSchema = narrativeStatusSchema;

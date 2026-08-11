import { z } from "zod";

export const TEMPORAL_SUMMARY_COMPONENT = "temporal_summary" as const;

export const temporalSummaryWindowSchema = z.enum(["day", "month", "year"]);

export type TemporalSummaryWindow = z.infer<typeof temporalSummaryWindowSchema>;

/** Global objective time digest; conversation-scoped digests live on conversations.temporal_day */
export const temporalSummaryBodySchema = z.object({
  window: temporalSummaryWindowSchema,
  /** CST calendar date YYYY-MM-DD: day=that day, month=1st, year=Jan 1 */
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Set when content is empty (skip / no material); cleared on successful regenerate */
  empty_reason: z.string().min(1).nullable().optional(),
  /** Count of source rows that contributed (conversations / child summaries) */
  source_count: z.number().int().nonnegative().optional(),
});

export type TemporalSummaryBody = z.infer<typeof temporalSummaryBodySchema>;

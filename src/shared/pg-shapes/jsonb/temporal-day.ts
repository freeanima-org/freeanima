import { z } from "zod";

export const temporalDayChunkSchema = z.object({
  at: z.string().min(1),
  /** CST half-hour bucket start, e.g. 2026-07-18T06:00+08:00 */
  bucket: z.string().min(1),
  summary: z.string(),
  watermark_message_id: z.string().optional(),
  watermark_at: z.string().optional(),
});

export type TemporalDayChunk = z.infer<typeof temporalDayChunkSchema>;

export const temporalDayJsonSchema = z.object({
  cst_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chunks: z.array(temporalDayChunkSchema).default([]),
});

export type TemporalDayJson = z.infer<typeof temporalDayJsonSchema>;

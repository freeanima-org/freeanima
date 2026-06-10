import { z } from "zod";

/** sessions.compression JSONB storage shape (no legacy anchor_id) */
export const compressionJsonSchema = z.object({
  l2: z.number(),
  l3: z.number(),
  summary: z.string().optional(),
  summary_at: z.string().optional(),
});

export type CompressionJson = z.infer<typeof compressionJsonSchema>;

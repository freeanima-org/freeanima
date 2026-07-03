import { z } from "zod";

export const dreamEntryRowSchema = z.object({
  id: z.number().int().positive(),
  dream_day: z.string(),
  content: z.string(),
  source_limbic_ids: z.array(z.string()),
  source_conversation_ids: z.array(z.string()),
  episodic_snippets: z.array(
    z.object({
      conversation_id: z.string(),
      message_id: z.string().optional(),
      role: z.string(),
      content: z.string(),
      timestamp: z.string().optional(),
    }),
  ),
  legacy_id: z.string().optional(),
  created_at: z.string(),
});

export type DreamEntryRowPayload = z.infer<typeof dreamEntryRowSchema>;

export const dreamListInputSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional(),
});
export type DreamListInput = z.infer<typeof dreamListInputSchema>;
export const dreamListOutputSchema = z.object({
  items: z.array(dreamEntryRowSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export type DreamListOutput = z.infer<typeof dreamListOutputSchema>;

export const dreamGetInputSchema = z.object({
  day: z.string().min(1),
});
export type DreamGetInput = z.infer<typeof dreamGetInputSchema>;
export const dreamGetOutputSchema = z.object({ item: dreamEntryRowSchema });
export type DreamGetOutput = z.infer<typeof dreamGetOutputSchema>;

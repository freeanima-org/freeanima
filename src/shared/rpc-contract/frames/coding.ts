import { z } from "zod";

export const codingNoteCreateInputSchema = z.object({
  /** 项目 Public World id（conversation.project_world_id） */
  world_id: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).optional(),
  content: z.string().max(200_000).optional(),
  /** coding_note.body.kind，如 explore / decision */
  kind: z.string().trim().min(1).max(64).optional(),
});
export type CodingNoteCreateInput = z.infer<typeof codingNoteCreateInputSchema>;

export const codingNoteRowSchema = z.object({
  id: z.number().int().positive(),
  world_id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  kind: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CodingNoteRowPayload = z.infer<typeof codingNoteRowSchema>;

export const codingNoteCreateOutputSchema = z.object({
  item: codingNoteRowSchema,
});
export type CodingNoteCreateOutput = z.infer<typeof codingNoteCreateOutputSchema>;

export const codingNoteListInputSchema = z.object({
  world_id: z.number().int().positive(),
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type CodingNoteListInput = z.infer<typeof codingNoteListInputSchema>;

export const codingNoteListOutputSchema = z.object({
  items: z.array(codingNoteRowSchema),
  count: z.number().int().nonnegative(),
});
export type CodingNoteListOutput = z.infer<typeof codingNoteListOutputSchema>;

import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

export const noteTextBlockSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().default(""),
  content: z.string(),
  sort_order: z.number().int(),
  parent_id: z.number().int().positive(),
  client_op_id: z.string().nullable(),
  components: z.array(z.string()).default([]),
  tag_ids: z.array(z.number().int().positive()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type NoteTextBlockPayload = z.infer<typeof noteTextBlockSchema>;

export const noteRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  tag_ids: z.array(z.number().int().positive()),
  blocks: z.array(noteTextBlockSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type NoteRowPayload = z.infer<typeof noteRowSchema>;

export const noteListInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  tag_ids: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type NoteListInput = z.infer<typeof noteListInputSchema>;
export const noteListOutputSchema = z.object({
  items: z.array(noteRowSchema),
});
export type NoteListOutput = z.infer<typeof noteListOutputSchema>;

export const noteCreateInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  title: z.string().min(1),
  /** 若有则建首条 text block */
  content: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type NoteCreateInput = z.infer<typeof noteCreateInputSchema>;
export const noteCreateOutputSchema = z.object({ item: noteRowSchema });
export type NoteCreateOutput = z.infer<typeof noteCreateOutputSchema>;

/** append = 在容器末尾新建一条 text block */
export const noteAppendInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  content: z.string().min(1),
  client_op_id: z.string().min(1).optional(),
});
export type NoteAppendInput = z.infer<typeof noteAppendInputSchema>;
export const noteAppendOutputSchema = z.object({ item: noteRowSchema });
export type NoteAppendOutput = z.infer<typeof noteAppendOutputSchema>;

export const notePatchInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type NotePatchInput = z.infer<typeof notePatchInputSchema>;
export const notePatchOutputSchema = z.object({ item: noteRowSchema });
export type NotePatchOutput = z.infer<typeof notePatchOutputSchema>;

export const noteDeleteInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  client_op_id: z.string().min(1).optional(),
});
export type NoteDeleteInput = z.infer<typeof noteDeleteInputSchema>;
export const noteDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type NoteDeleteOutput = z.infer<typeof noteDeleteOutputSchema>;

export const noteGetInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int().positive(),
});
export type NoteGetInput = z.infer<typeof noteGetInputSchema>;
export const noteGetOutputSchema = z.object({ item: noteRowSchema });
export type NoteGetOutput = z.infer<typeof noteGetOutputSchema>;

export const noteSearchInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  query: z.string().min(1),
  tag_ids: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().positive().optional(),
});
export type NoteSearchInput = z.infer<typeof noteSearchInputSchema>;
export const noteSearchOutputSchema = z.object({
  items: z.array(noteRowSchema),
});
export type NoteSearchOutput = z.infer<typeof noteSearchOutputSchema>;

export const noteBlockCreateInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  parent_id: z.number().int().positive(),
  content: z.string(),
  title: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  components: z.array(z.string().min(1)).optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type NoteBlockCreateInput = z.infer<typeof noteBlockCreateInputSchema>;
export const noteBlockCreateOutputSchema = z.object({ item: noteTextBlockSchema });
export type NoteBlockCreateOutput = z.infer<typeof noteBlockCreateOutputSchema>;

export const noteBlockPatchInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int().positive(),
  content: z.string().optional(),
  title: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type NoteBlockPatchInput = z.infer<typeof noteBlockPatchInputSchema>;
export const noteBlockPatchOutputSchema = z.object({ item: noteTextBlockSchema });
export type NoteBlockPatchOutput = z.infer<typeof noteBlockPatchOutputSchema>;

export const noteBlockDeleteInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type NoteBlockDeleteInput = z.infer<typeof noteBlockDeleteInputSchema>;
export const noteBlockDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type NoteBlockDeleteOutput = z.infer<typeof noteBlockDeleteOutputSchema>;

export const noteBlockReorderInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      sort_order: z.number().int(),
    }),
  ),
});
export type NoteBlockReorderInput = z.infer<typeof noteBlockReorderInputSchema>;
export const noteBlockReorderOutputSchema = z.object({
  items: z.array(noteTextBlockSchema),
});
export type NoteBlockReorderOutput = z.infer<typeof noteBlockReorderOutputSchema>;

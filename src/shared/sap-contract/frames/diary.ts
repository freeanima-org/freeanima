import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

export const diaryTextBlockSchema = z.object({
  id: z.number().int().positive(),
  content: z.string(),
  sort_order: z.number().int(),
  parent_id: z.number().int().positive(),
  client_op_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DiaryTextBlockPayload = z.infer<typeof diaryTextBlockSchema>;

export const diaryEntryRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  entry_at: z.string(),
  tags: z.array(z.string()),
  blocks: z.array(diaryTextBlockSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DiaryEntryRowPayload = z.infer<typeof diaryEntryRowSchema>;

export const diaryListInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  entry_after: z.string().optional(),
  entry_before: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type DiaryListInput = z.infer<typeof diaryListInputSchema>;
export const diaryListOutputSchema = z.object({
  items: z.array(diaryEntryRowSchema),
});
export type DiaryListOutput = z.infer<typeof diaryListOutputSchema>;

export const diaryCreateInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  title: z.string().min(1),
  /** 若有则建首条 text block */
  content: z.string().optional(),
  summary: z.string().optional(),
  entry_at: z.string().min(1),
  tags: z.array(z.string()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryCreateInput = z.infer<typeof diaryCreateInputSchema>;
export const diaryCreateOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryCreateOutput = z.infer<typeof diaryCreateOutputSchema>;

/** append = 在容器末尾新建一条 text block */
export const diaryAppendInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  content: z.string().min(1),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryAppendInput = z.infer<typeof diaryAppendInputSchema>;
export const diaryAppendOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryAppendOutput = z.infer<typeof diaryAppendOutputSchema>;

export const diaryPatchInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  entry_at: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryPatchInput = z.infer<typeof diaryPatchInputSchema>;
export const diaryPatchOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryPatchOutput = z.infer<typeof diaryPatchOutputSchema>;

export const diaryDeleteInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryDeleteInput = z.infer<typeof diaryDeleteInputSchema>;
export const diaryDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type DiaryDeleteOutput = z.infer<typeof diaryDeleteOutputSchema>;

export const diaryGetInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int().positive(),
});
export type DiaryGetInput = z.infer<typeof diaryGetInputSchema>;
export const diaryGetOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryGetOutput = z.infer<typeof diaryGetOutputSchema>;

export const diarySearchInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  query: z.string().min(1),
  entry_after: z.string().optional(),
  entry_before: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
});
export type DiarySearchInput = z.infer<typeof diarySearchInputSchema>;
export const diarySearchOutputSchema = z.object({
  items: z.array(diaryEntryRowSchema),
});
export type DiarySearchOutput = z.infer<typeof diarySearchOutputSchema>;

export const diaryBlockCreateInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  parent_id: z.number().int().positive(),
  content: z.string(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryBlockCreateInput = z.infer<typeof diaryBlockCreateInputSchema>;
export const diaryBlockCreateOutputSchema = z.object({ item: diaryTextBlockSchema });
export type DiaryBlockCreateOutput = z.infer<typeof diaryBlockCreateOutputSchema>;

export const diaryBlockPatchInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int().positive(),
  content: z.string().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryBlockPatchInput = z.infer<typeof diaryBlockPatchInputSchema>;
export const diaryBlockPatchOutputSchema = z.object({ item: diaryTextBlockSchema });
export type DiaryBlockPatchOutput = z.infer<typeof diaryBlockPatchOutputSchema>;

export const diaryBlockDeleteInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryBlockDeleteInput = z.infer<typeof diaryBlockDeleteInputSchema>;
export const diaryBlockDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type DiaryBlockDeleteOutput = z.infer<typeof diaryBlockDeleteOutputSchema>;

export const diaryBlockReorderInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      sort_order: z.number().int(),
    }),
  ),
});
export type DiaryBlockReorderInput = z.infer<typeof diaryBlockReorderInputSchema>;
export const diaryBlockReorderOutputSchema = z.object({
  items: z.array(diaryTextBlockSchema),
});
export type DiaryBlockReorderOutput = z.infer<typeof diaryBlockReorderOutputSchema>;

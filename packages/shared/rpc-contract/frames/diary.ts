import { z } from "zod";

export const diaryTextBlockSchema = z.object({
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

export type DiaryTextBlockPayload = z.infer<typeof diaryTextBlockSchema>;

export const diaryEntryRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  entry_at: z.string(),
  tag_ids: z.array(z.number().int().positive()),
  blocks: z.array(diaryTextBlockSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DiaryEntryRowPayload = z.infer<typeof diaryEntryRowSchema>;

export const diaryListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  entry_after: z.string().optional(),
  entry_before: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type DiaryListInput = z.infer<typeof diaryListInputSchema>;
export const diaryListOutputSchema = z.object({
  items: z.array(diaryEntryRowSchema),
});
export type DiaryListOutput = z.infer<typeof diaryListOutputSchema>;

export const diaryCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  /** 若有则建首条 text block */
  content: z.string().optional(),
  summary: z.string().optional(),
  entry_at: z.string().min(1),
  tags: z.array(z.string()).optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryCreateInput = z.infer<typeof diaryCreateInputSchema>;
export const diaryCreateOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryCreateOutput = z.infer<typeof diaryCreateOutputSchema>;

/** append = 在容器末尾新建一条 text block */
export const diaryAppendInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int(),
  content: z.string().min(1),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryAppendInput = z.infer<typeof diaryAppendInputSchema>;
export const diaryAppendOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryAppendOutput = z.infer<typeof diaryAppendOutputSchema>;

export const diaryPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  entry_at: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
});
export type DiaryPatchInput = z.infer<typeof diaryPatchInputSchema>;
export const diaryPatchOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryPatchOutput = z.infer<typeof diaryPatchOutputSchema>;

export const diaryDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int(),
});
export type DiaryDeleteInput = z.infer<typeof diaryDeleteInputSchema>;
export const diaryDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type DiaryDeleteOutput = z.infer<typeof diaryDeleteOutputSchema>;

export const diaryGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type DiaryGetInput = z.infer<typeof diaryGetInputSchema>;
export const diaryGetOutputSchema = z.object({ item: diaryEntryRowSchema });
export type DiaryGetOutput = z.infer<typeof diaryGetOutputSchema>;

export const diarySearchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  query: z.string().min(1),
  entry_after: z.string().optional(),
  entry_before: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().positive().optional(),
});
export type DiarySearchInput = z.infer<typeof diarySearchInputSchema>;
export const diarySearchOutputSchema = z.object({
  items: z.array(diaryEntryRowSchema),
});
export type DiarySearchOutput = z.infer<typeof diarySearchOutputSchema>;

export const diaryBlockCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  parent_id: z.number().int().positive(),
  content: z.string(),
  title: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  components: z.array(z.string().min(1)).optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryBlockCreateInput = z.infer<typeof diaryBlockCreateInputSchema>;
export const diaryBlockCreateOutputSchema = z.object({ item: diaryTextBlockSchema });
export type DiaryBlockCreateOutput = z.infer<typeof diaryBlockCreateOutputSchema>;

export const diaryBlockPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  content: z.string().optional(),
  title: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  sort_order: z.number().int().optional(),
});
export type DiaryBlockPatchInput = z.infer<typeof diaryBlockPatchInputSchema>;
export const diaryBlockPatchOutputSchema = z.object({ item: diaryTextBlockSchema });
export type DiaryBlockPatchOutput = z.infer<typeof diaryBlockPatchOutputSchema>;

export const diaryBlockDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type DiaryBlockDeleteInput = z.infer<typeof diaryBlockDeleteInputSchema>;
export const diaryBlockDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type DiaryBlockDeleteOutput = z.infer<typeof diaryBlockDeleteOutputSchema>;

export const diaryBlockReorderInputSchema = z.object({
  subject_id: z.number().int().positive(),
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

/** 日记块模板：name=模板名；preset=插入块载荷 */
export const diaryBlockTemplatePresetSchema = z.object({
  title: z.string().default(""),
  content: z.string().default(""),
  components: z.array(z.string().min(1)).min(1),
  tag_ids: z.array(z.number().int().positive()).default([]),
});

export type DiaryBlockTemplatePresetPayload = z.infer<typeof diaryBlockTemplatePresetSchema>;

export const diaryBlockTemplateRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  sort_order: z.number().int(),
  preset: diaryBlockTemplatePresetSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type DiaryBlockTemplateRowPayload = z.infer<typeof diaryBlockTemplateRowSchema>;

export const diaryTemplateListInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export type DiaryTemplateListInput = z.infer<typeof diaryTemplateListInputSchema>;
export const diaryTemplateListOutputSchema = z.object({
  items: z.array(diaryBlockTemplateRowSchema),
});
export type DiaryTemplateListOutput = z.infer<typeof diaryTemplateListOutputSchema>;

export const diaryTemplateCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  name: z.string().min(1),
  preset: diaryBlockTemplatePresetSchema,
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type DiaryTemplateCreateInput = z.infer<typeof diaryTemplateCreateInputSchema>;
export const diaryTemplateCreateOutputSchema = z.object({ item: diaryBlockTemplateRowSchema });
export type DiaryTemplateCreateOutput = z.infer<typeof diaryTemplateCreateOutputSchema>;

export const diaryTemplatePatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  name: z.string().min(1).optional(),
  /** 勿对带 default 的 preset schema 做 .partial()，否则缺省字段会被默认值覆盖 */
  preset: z
    .object({
      title: z.string().optional(),
      content: z.string().optional(),
      components: z.array(z.string().min(1)).min(1).optional(),
      tag_ids: z.array(z.number().int().positive()).optional(),
    })
    .optional(),
  sort_order: z.number().int().optional(),
});
export type DiaryTemplatePatchInput = z.infer<typeof diaryTemplatePatchInputSchema>;
export const diaryTemplatePatchOutputSchema = z.object({ item: diaryBlockTemplateRowSchema });
export type DiaryTemplatePatchOutput = z.infer<typeof diaryTemplatePatchOutputSchema>;

export const diaryTemplateDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type DiaryTemplateDeleteInput = z.infer<typeof diaryTemplateDeleteInputSchema>;
export const diaryTemplateDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type DiaryTemplateDeleteOutput = z.infer<typeof diaryTemplateDeleteOutputSchema>;

/** 日记实体级 tags 建议（本 world 频次；默认 top10） */
export const diarySuggestTagsInputSchema = z.object({
  subject_id: z.number().int().positive(),
  query: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});
export type DiarySuggestTagsInput = z.infer<typeof diarySuggestTagsInputSchema>;
export const diarySuggestTagsOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});
export type DiarySuggestTagsOutput = z.infer<typeof diarySuggestTagsOutputSchema>;

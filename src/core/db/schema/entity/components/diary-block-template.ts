import { z } from "zod";

import { CONTENT_BLOCK_COMPONENT } from "./content-block.ts";

export const DIARY_BLOCK_TEMPLATE_COMPONENT = "diary_block_template" as const;

/** 插入 content_block 时使用的预设（与模板实体 title/content/tag_ids 列分离） */
export const diaryBlockTemplatePresetSchema = z.object({
  title: z.string().default(""),
  content: z.string().default(""),
  components: z.array(z.string().min(1)).min(1).default([CONTENT_BLOCK_COMPONENT]),
  tag_ids: z.array(z.number().int().positive()).default([]),
});

export type DiaryBlockTemplatePreset = z.infer<typeof diaryBlockTemplatePresetSchema>;

export const diaryBlockTemplateBodySchema = z.object({
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
  preset: diaryBlockTemplatePresetSchema,
});

export type DiaryBlockTemplateBody = z.infer<typeof diaryBlockTemplateBodySchema>;

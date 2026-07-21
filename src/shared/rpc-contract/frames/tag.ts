import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

const tagSubjectKindSchema = notificationRecipientKindSchema.default("user");

export const tagRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TagRowPayload = z.infer<typeof tagRowSchema>;

export const tagListInputSchema = z.object({
  subject_kind: tagSubjectKindSchema,
});
export type TagListInput = z.infer<typeof tagListInputSchema>;
export const tagListOutputSchema = z.object({ tags: z.array(tagRowSchema) });
export type TagListOutput = z.infer<typeof tagListOutputSchema>;

export const tagSearchInputSchema = z.object({
  subject_kind: tagSubjectKindSchema,
  query: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type TagSearchInput = z.infer<typeof tagSearchInputSchema>;
export const tagSearchOutputSchema = z.object({
  tags: z.array(tagRowSchema),
  count: z.number().int().nonnegative(),
});
export type TagSearchOutput = z.infer<typeof tagSearchOutputSchema>;

export const tagCreateInputSchema = z.object({
  subject_kind: tagSubjectKindSchema,
  title: z.string().min(1),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TagCreateInput = z.infer<typeof tagCreateInputSchema>;
export const tagCreateOutputSchema = z.object({ item: tagRowSchema });
export type TagCreateOutput = z.infer<typeof tagCreateOutputSchema>;

export const tagPatchInputSchema = z.object({
  subject_kind: tagSubjectKindSchema,
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
});
export type TagPatchInput = z.infer<typeof tagPatchInputSchema>;
export const tagPatchOutputSchema = z.object({ item: tagRowSchema });
export type TagPatchOutput = z.infer<typeof tagPatchOutputSchema>;

export const tagDeleteInputSchema = z.object({
  subject_kind: tagSubjectKindSchema,
  id: z.number().int().positive(),
});
export type TagDeleteInput = z.infer<typeof tagDeleteInputSchema>;
export const tagDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type TagDeleteOutput = z.infer<typeof tagDeleteOutputSchema>;

export const tagSetOnEntityInputSchema = z.object({
  subject_kind: tagSubjectKindSchema,
  entity_id: z.number().int().positive(),
  tag_ids: z.array(z.number().int().positive()),
});
export type TagSetOnEntityInput = z.infer<typeof tagSetOnEntityInputSchema>;
export const tagSetOnEntityOutputSchema = z.object({
  entity_id: z.number().int().positive(),
  tag_ids: z.array(z.number().int().positive()),
});
export type TagSetOnEntityOutput = z.infer<typeof tagSetOnEntityOutputSchema>;

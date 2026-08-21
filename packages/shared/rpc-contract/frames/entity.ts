import { z } from "zod";

export const entityAdminRowSchema = z.object({
  id: z.number().int().positive(),
  type: z.string(),
  title: z.string(),
  /** 列表预览：DB summary，或 content/snippet 截断 */
  summary: z.string(),
  primary_component: z.string().nullable(),
  components: z.array(z.string()),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  world_id: z.number().int().positive(),
});
export type EntityAdminRowPayload = z.infer<typeof entityAdminRowSchema>;

/** 实体浏览器详情（含正文 / body；不含完整 revisions） */
export const entityDetailSchema = entityAdminRowSchema.extend({
  content: z.string(),
  body: z.record(z.string(), z.unknown()),
  pinned: z.boolean(),
  reference_count: z.number(),
  tag_ids: z.array(z.number().int().positive()),
  revision_count: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type EntityDetailPayload = z.infer<typeof entityDetailSchema>;

export const entityReferenceHitSchema = z.object({
  entity_id: z.number().int().positive(),
  via: z.string(),
});
export type EntityReferenceHitPayload = z.infer<typeof entityReferenceHitSchema>;

export const entityAdminTypeSchema = z.enum(["content", "world", "agent", "user"]);
export type EntityAdminType = z.infer<typeof entityAdminTypeSchema>;

export const entityListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
  /** 实体 type 过滤 */
  type: entityAdminTypeSchema.optional(),
  /** 主组件名过滤 */
  primary_component: z.string().trim().min(1).optional(),
  /**
   * 关键词（title/summary/content）；纯正整数或 `anima:{id}` 走精确 id 查询。
   */
  query: z.string().optional(),
});
export type EntityListInput = z.infer<typeof entityListInputSchema>;
export const entityListOutputSchema = z.object({
  items: z.array(entityAdminRowSchema),
  count: z.number().int().nonnegative(),
});
export type EntityListOutput = z.infer<typeof entityListOutputSchema>;

export const entityTrashListInputSchema = entityListInputSchema;
export type EntityTrashListInput = z.infer<typeof entityTrashListInputSchema>;
export const entityTrashListOutputSchema = entityListOutputSchema;
export type EntityTrashListOutput = z.infer<typeof entityTrashListOutputSchema>;

export const entityGetInputSchema = z.object({
  id: z.number().int().positive(),
  /** 回收站详情需 true */
  include_deleted: z.boolean().optional(),
});
export type EntityGetInput = z.infer<typeof entityGetInputSchema>;
export const entityGetOutputSchema = z.object({
  item: entityDetailSchema,
});
export type EntityGetOutput = z.infer<typeof entityGetOutputSchema>;

export const entityDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  force: z.boolean().optional(),
});
export type EntityDeleteInput = z.infer<typeof entityDeleteInputSchema>;
export const entityDeleteOutputSchema = z.object({
  ok: z.boolean(),
  references: z.array(entityReferenceHitSchema).optional(),
});
export type EntityDeleteOutput = z.infer<typeof entityDeleteOutputSchema>;

export const entityRestoreInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type EntityRestoreInput = z.infer<typeof entityRestoreInputSchema>;
export const entityRestoreOutputSchema = z.object({ ok: z.literal(true) });
export type EntityRestoreOutput = z.infer<typeof entityRestoreOutputSchema>;

export const entityDeleteComponentInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  component: z.string().min(1),
});
export type EntityDeleteComponentInput = z.infer<typeof entityDeleteComponentInputSchema>;
export const entityDeleteComponentOutputSchema = z.object({ item: entityAdminRowSchema });
export type EntityDeleteComponentOutput = z.infer<typeof entityDeleteComponentOutputSchema>;

export const entityAddComponentInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  component: z.string().min(1),
  body: z.record(z.string(), z.unknown()).optional(),
  promote_primary: z.boolean().optional(),
});
export type EntityAddComponentInput = z.infer<typeof entityAddComponentInputSchema>;
export const entityAddComponentOutputSchema = z.object({ item: entityAdminRowSchema });
export type EntityAddComponentOutput = z.infer<typeof entityAddComponentOutputSchema>;

export const entitySetPrimaryComponentInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  component: z.string().min(1),
});
export type EntitySetPrimaryComponentInput = z.infer<typeof entitySetPrimaryComponentInputSchema>;
export const entitySetPrimaryComponentOutputSchema = z.object({ item: entityAdminRowSchema });
export type EntitySetPrimaryComponentOutput = z.infer<typeof entitySetPrimaryComponentOutputSchema>;

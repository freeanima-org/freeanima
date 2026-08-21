import { z } from "zod";

export const bookmarkKindSchema = z.enum(["folder", "url"]);

export const bookmarkRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  kind: bookmarkKindSchema,
  url: z.string().nullable(),
  parent_id: z.number().int().positive().nullable(),
  sort_order: z.number().int(),
  browser_id: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type BookmarkRowPayload = z.infer<typeof bookmarkRowSchema>;

export const bookmarkListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable().optional(),
  kind: bookmarkKindSchema.optional(),
  limit: z.number().int().positive().max(5000).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type BookmarkListInput = z.infer<typeof bookmarkListInputSchema>;
export const bookmarkListOutputSchema = z.object({
  items: z.array(bookmarkRowSchema),
});
export type BookmarkListOutput = z.infer<typeof bookmarkListOutputSchema>;

export const bookmarkGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type BookmarkGetInput = z.infer<typeof bookmarkGetInputSchema>;
export const bookmarkGetOutputSchema = z.object({ item: bookmarkRowSchema });
export type BookmarkGetOutput = z.infer<typeof bookmarkGetOutputSchema>;

export const bookmarkSearchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  query: z.string().min(1),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type BookmarkSearchInput = z.infer<typeof bookmarkSearchInputSchema>;
export const bookmarkSearchOutputSchema = z.object({
  items: z.array(bookmarkRowSchema),
  count: z.number().int().nonnegative(),
});
export type BookmarkSearchOutput = z.infer<typeof bookmarkSearchOutputSchema>;

export const bookmarkCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string(),
  kind: bookmarkKindSchema,
  url: z.string().nullable().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  browser_id: z.string().min(1).nullable().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type BookmarkCreateInput = z.infer<typeof bookmarkCreateInputSchema>;
export const bookmarkCreateOutputSchema = z.object({ item: bookmarkRowSchema });
export type BookmarkCreateOutput = z.infer<typeof bookmarkCreateOutputSchema>;

export const bookmarkPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string().optional(),
  kind: bookmarkKindSchema.optional(),
  url: z.string().nullable().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  browser_id: z.string().min(1).nullable().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type BookmarkPatchInput = z.infer<typeof bookmarkPatchInputSchema>;
export const bookmarkPatchOutputSchema = z.object({ item: bookmarkRowSchema });
export type BookmarkPatchOutput = z.infer<typeof bookmarkPatchOutputSchema>;

export const bookmarkDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type BookmarkDeleteInput = z.infer<typeof bookmarkDeleteInputSchema>;
export const bookmarkDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type BookmarkDeleteOutput = z.infer<typeof bookmarkDeleteOutputSchema>;

export const bookmarkUpsertItemSchema = z.object({
  title: z.string(),
  kind: bookmarkKindSchema,
  url: z.string().nullable().optional(),
  /** 父节点的 browser_id；根级可空 */
  parent_browser_id: z.string().min(1).nullable().optional(),
  /** 已解析的父文件夹 entity id（优先于 parent_browser_id） */
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  browser_id: z.string().min(1),
  client_op_id: z.string().min(1).optional(),
  /** 软删：扩展侧浏览器已删除 */
  deleted: z.boolean().optional(),
});

export const bookmarkUpsertBatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  items: z.array(bookmarkUpsertItemSchema).min(1).max(500),
});
export type BookmarkUpsertBatchInput = z.infer<typeof bookmarkUpsertBatchInputSchema>;
export const bookmarkUpsertBatchOutputSchema = z.object({
  items: z.array(bookmarkRowSchema),
});
export type BookmarkUpsertBatchOutput = z.infer<typeof bookmarkUpsertBatchOutputSchema>;

export const bookmarkSyncPullInputSchema = z.object({
  subject_id: z.number().int().positive(),
  updated_after: z.string().optional(),
  limit: z.number().int().positive().max(5000).optional(),
});
export type BookmarkSyncPullInput = z.infer<typeof bookmarkSyncPullInputSchema>;
export const bookmarkSyncPullOutputSchema = z.object({
  items: z.array(bookmarkRowSchema),
});
export type BookmarkSyncPullOutput = z.infer<typeof bookmarkSyncPullOutputSchema>;

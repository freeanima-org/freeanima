import { BOOKMARK_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { BOOKMARK_COMPONENT };

import { z } from "zod";

export const bookmarkKindSchema = z.enum(["folder", "url"]);

export type BookmarkKind = z.infer<typeof bookmarkKindSchema>;

/**
 * 浏览器书签节点（文件夹或 URL）。
 * `browser_id` = Chrome/Firefox bookmarks API 节点 id，用于幂等同步。
 */
export const bookmarkBodySchema = z.object({
  kind: bookmarkKindSchema,
  /** URL 节点的链接；folder 可空 */
  url: z.string().nullable().optional(),
  /** 父文件夹 entity id；null/缺省 = 根级（扩展侧通常仍挂在浏览器根文件夹下） */
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  /** 浏览器书签节点 id（字符串） */
  browser_id: z.string().min(1).nullable().optional(),
  client_op_id: z.string().min(1).nullable().optional(),
});

export type BookmarkBody = z.infer<typeof bookmarkBodySchema>;

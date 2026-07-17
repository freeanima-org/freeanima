import { z } from "zod";

export const CONTENT_BLOCK_COMPONENT = "content_block" as const;

export const contentBlockTypeSchema = z.enum([
  "text",
  "image",
  "audio",
  "video",
  "link_card",
  "file",
]);

export type ContentBlockType = z.infer<typeof contentBlockTypeSchema>;

export const contentBlockBodySchema = z.object({
  block_type: contentBlockTypeSchema,
  /** 容器 entity id（diary_entry；未来 dream_entry / note） */
  parent_id: z.number().int().positive(),
  sort_order: z.number().int(),
  /** 非 text 类型的资源定位；text 可空 */
  url: z.string().min(1).nullable().default(null),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type ContentBlockBody = z.infer<typeof contentBlockBodySchema>;

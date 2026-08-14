import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/habitat/core/tool";

const fileRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  world_id: z.number(),
  cid: z.string(),
  size: z.number(),
  mime_type: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const folderRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  world_id: z.number(),
  parent_id: z.number().nullable(),
  file_ids: z.array(z.number()),
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleFile = {
  id: 1,
  title: "photo.jpg",
  world_id: 10,
  cid: "48fc721fbbc172e0925fa27af1671de2",
  size: 1024,
  mime_type: "image/jpeg",
  created_at: "2026-07-27T00:00:00.000Z",
  updated_at: "2026-07-27T00:00:00.000Z",
};

const exampleFolder = {
  id: 2,
  title: "相册",
  world_id: 10,
  parent_id: null,
  file_ids: [1],
  created_at: "2026-07-27T00:00:00.000Z",
  updated_at: "2026-07-27T00:00:00.000Z",
};

export const OBJECT_STORAGE_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  object_storage_upload: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("upload"), item: fileRowSchema }),
    example: { ok: true, action: "upload", item: exampleFile },
  }),
  object_storage_download: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("download"),
      path: z.string(),
      item: fileRowSchema,
    }),
    example: { ok: true, action: "download", path: "/tmp/photo.jpg", item: exampleFile },
  }),
  object_storage_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      items: z.array(fileRowSchema),
    }),
    example: { ok: true, action: "list", count: 1, items: [exampleFile] },
  }),
  object_storage_delete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("delete"), id: z.number() }),
    example: { ok: true, action: "delete", id: 1 },
  }),
  object_storage_folder_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("folder_create"),
      item: folderRowSchema,
    }),
    example: { ok: true, action: "folder_create", item: exampleFolder },
  }),
  object_storage_folder_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("folder_list"),
      count: z.number(),
      items: z.array(folderRowSchema),
    }),
    example: { ok: true, action: "folder_list", count: 1, items: [exampleFolder] },
  }),
  object_storage_folder_add_file: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("folder_add_file"),
      item: folderRowSchema,
    }),
    example: { ok: true, action: "folder_add_file", item: exampleFolder },
  }),
  object_storage_folder_remove_file: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("folder_remove_file"),
      item: folderRowSchema,
    }),
    example: { ok: true, action: "folder_remove_file", item: exampleFolder },
  }),
  object_storage_folder_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("folder_delete"),
      id: z.number(),
    }),
    example: { ok: true, action: "folder_delete", id: 2 },
  }),
};

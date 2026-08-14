import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/habitat/core/tool";

const projectRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  folder_id: z.number().nullable(),
});

const folderRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number().nullable(),
});

const exampleProject = {
  id: 1,
  title: "示例项目",
  status: "active",
  start_at: "2026-07-01T00:00:00+08:00",
  end_at: "2026-12-31T00:00:00+08:00",
  folder_id: null,
};

export const PROJECT_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  project_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      projects: z.array(projectRowSchema),
    }),
    example: { ok: true, action: "list", count: 1, projects: [exampleProject] },
  }),
  project_get: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("get"), item: projectRowSchema }),
    example: { ok: true, action: "get", item: exampleProject },
  }),
  project_create: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("create"), item: projectRowSchema }),
    example: { ok: true, action: "create", item: exampleProject },
  }),
  project_patch: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("patch"), item: projectRowSchema }),
    example: { ok: true, action: "patch", item: exampleProject },
  }),
  project_delete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("delete") }),
    example: { ok: true, action: "delete" },
  }),
  projectfolder_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      folders: z.array(folderRowSchema),
    }),
    example: {
      ok: true,
      action: "list",
      count: 1,
      folders: [{ id: 1, name: "工作", parent_id: null }],
    },
  }),
  projectfolder_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("create"),
      item: folderRowSchema,
    }),
    example: { ok: true, action: "create", item: { id: 1, name: "工作", parent_id: null } },
  }),
};

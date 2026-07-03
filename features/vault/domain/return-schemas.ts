import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

const vaultItemMetaSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  item_type: z.enum(["login", "secure_note", "card", "identity", "custom"]),
  url: z.string().optional(),
  username: z.string().optional(),
  tags: z.array(z.string()),
  custom_field_names: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleItem = {
  id: 10,
  title: "示例条目",
  content: "",
  item_type: "login" as const,
  url: "https://example.com",
  username: "user@example.com",
  tags: ["工作"],
  custom_field_names: [],
  created_at: "2026-06-10T10:00:00+08:00",
  updated_at: "2026-06-10T10:00:00+08:00",
};

export const VAULT_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  vault_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      items: z.array(vaultItemMetaSchema),
    }),
    example: { ok: true, action: "list", count: 1, items: [exampleItem] },
  }),
  vault_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      items: z.array(vaultItemMetaSchema),
    }),
    example: { ok: true, action: "search", count: 1, items: [exampleItem] },
  }),
  vault_get_meta: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("get_meta"),
      item: vaultItemMetaSchema,
    }),
    example: { ok: true, action: "get_meta", item: exampleItem },
  }),
  vault_inject_env: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("inject_env"),
      env_name: z.string(),
      item_id: z.number(),
      subject_kind: z.enum(["user", "agent"]),
    }),
    example: {
      ok: true,
      action: "inject_env",
      env_name: "PGPASSWORD",
      item_id: 10,
      subject_kind: "agent",
    },
  }),
};

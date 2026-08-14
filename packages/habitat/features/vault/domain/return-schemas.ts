import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/habitat/core/tool";

const vaultItemMetaSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  item_type: z.enum(["login", "secure_note", "card", "identity", "custom"]),
  url: z.string().optional(),
  uris: z
    .array(
      z.object({
        uri: z.string(),
        match: z.enum(["domain", "host", "starts_with", "exact", "regex", "never"]).optional(),
      }),
    )
    .optional(),
  username: z.string().optional(),
  tag_ids: z.array(z.number()),
  custom_field_names: z.array(z.string()),
  import_refs: z
    .object({ bitwarden: z.string().optional(), agent_root_key: z.string().optional() })
    .optional(),
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
  tag_ids: [1],
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
  vault_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("create"),
      item: vaultItemMetaSchema,
    }),
    example: { ok: true, action: "create", item: exampleItem },
  }),
  vault_update: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("update"),
      item: vaultItemMetaSchema,
    }),
    example: { ok: true, action: "update", item: exampleItem },
  }),
  vault_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("delete"),
      id: z.number(),
    }),
    example: { ok: true, action: "delete", id: 10 },
  }),
};

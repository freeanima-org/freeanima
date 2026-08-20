import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/habitat/core/tool";

const contactRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string(),
  emails: z.array(z.unknown()),
  phones: z.array(z.unknown()),
  addresses: z.array(z.unknown()),
  wechats: z.array(z.unknown()),
  subject_id: z.number().nullable(),
});

const exampleContact = {
  id: 1,
  title: "示例",
  summary: "",
  emails: [{ value: "a@b.com", identity_key: true }],
  phones: [],
  addresses: [],
  wechats: [],
  subject_id: null,
};

export const CONTACT_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  contact_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      contacts: z.array(contactRowSchema),
    }),
    example: { ok: true, action: "list", count: 1, contacts: [exampleContact] },
  }),
  contact_get: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("get"),
      contact: contactRowSchema,
    }),
    example: { ok: true, action: "get", contact: exampleContact },
  }),
  contact_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      contacts: z.array(contactRowSchema),
    }),
    example: { ok: true, action: "search", count: 1, contacts: [exampleContact] },
  }),
  contact_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("create"),
      contact: contactRowSchema,
    }),
    example: { ok: true, action: "create", contact: exampleContact },
  }),
  contact_patch: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("patch"),
      contact: contactRowSchema,
    }),
    example: { ok: true, action: "patch", contact: exampleContact },
  }),
  contact_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("delete"),
      id: z.number(),
    }),
    example: { ok: true, action: "delete", id: 1 },
  }),
  contact_resolve_by_address: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("resolve"),
      count: z.number(),
      contacts: z.array(contactRowSchema),
    }),
    example: { ok: true, action: "resolve", count: 1, contacts: [exampleContact] },
  }),
  contact_attach_address: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("attach"),
      contact: contactRowSchema,
    }),
    example: { ok: true, action: "attach", contact: exampleContact },
  }),
};

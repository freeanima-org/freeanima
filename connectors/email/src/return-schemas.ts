import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

const emailAccountSchema = z.object({
  id: z.string(),
  password: z.string(),
  address: z.string(),
  display_name: z.string().optional(),
  smtp_host: z.string(),
  smtp_port: z.number(),
  imap_host: z.string(),
  imap_port: z.number(),
  default_sender: z.boolean().optional(),
  enabled: z.boolean().optional(),
  desc: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const emailMessageSchema = z.object({
  uid: z.number(),
  account_id: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  date: z.string(),
  preview: z.string(),
  unread: z.boolean(),
  body: z.string().optional(),
});

const exampleAccount = {
  id: "main-inbox",
  password: 'credential("email/example", "password")',
  address: "you@example.com",
  display_name: "Example User",
  smtp_host: "smtp.example.com",
  smtp_port: 465,
  imap_host: "imap.example.com",
  imap_port: 993,
  default_sender: true,
  enabled: true,
};

const exampleMessage = {
  uid: 42,
  account_id: "main-inbox",
  from: "sender@example.com",
  to: "you@example.com",
  subject: "Hello",
  date: "2026-06-10T10:00:00+08:00",
  preview: "Email preview…",
  unread: true,
};

export const EMAIL_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  email_register_account: defineToolReturn({
    schema: z.object({ ok: z.literal(true), account: emailAccountSchema }),
    example: { ok: true, account: exampleAccount },
  }),
  email_edit_account: defineToolReturn({
    schema: z.object({ ok: z.literal(true), account: emailAccountSchema }),
    example: { ok: true, account: exampleAccount },
  }),
  email_list_accounts: defineToolReturn({
    schema: z.object({ accounts: z.array(emailAccountSchema) }),
    example: { accounts: [exampleAccount] },
  }),
  email_delete_account: defineToolReturn({
    schema: z.object({ ok: z.literal(true), id: z.string() }),
    example: { ok: true, id: "main-inbox" },
  }),
  email_send: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      messageId: z.string(),
      account_id: z.string(),
    }),
    example: {
      ok: true,
      messageId: "<abc@example.com>",
      account_id: "main-inbox",
    },
  }),
  email_fetch: defineToolReturn({
    schema: z.object({
      messages: z.array(emailMessageSchema),
      count: z.number(),
    }),
    example: { messages: [exampleMessage], count: 1 },
  }),
  email_list: defineToolReturn({
    schema: z.object({
      messages: z.array(emailMessageSchema),
      count: z.number(),
    }),
    example: { messages: [exampleMessage], count: 1 },
  }),
  email_read: defineToolReturn({
    schema: z.object({ message: emailMessageSchema }),
    example: {
      message: {
        ...exampleMessage,
        body: "Email body content",
        unread: false,
      },
    },
  }),
  email_mark_read: defineToolReturn({
    schema: z.object({ ok: z.literal(true) }),
    example: { ok: true },
  }),
  email_delete: defineToolReturn({
    schema: z.object({ ok: z.literal(true) }),
    example: { ok: true },
  }),
};

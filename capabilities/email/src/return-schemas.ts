import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

const accountSchema = z.object({
  id: z.number(),
  address: z.string(),
  display_name: z.string(),
  smtp_host: z.string(),
  smtp_port: z.number(),
  imap_host: z.string(),
  imap_port: z.number(),
  default_sender: z.boolean(),
  enabled: z.boolean(),
  password: z.string(),
});

const messageSchema = z.object({
  id: z.number(),
  account_id: z.number(),
  thread_id: z.number(),
  subject: z.string(),
  preview: z.string(),
  body: z.string(),
  from: z.string(),
  to: z.string(),
  sent_at: z.string(),
  unread: z.boolean(),
});

export const EMAIL_TOOL_RETURNS: Partial<Record<string, ToolReturnContractFields>> = {
  email_register_account: defineToolReturn({
    schema: z.object({ ok: z.literal(true), account: accountSchema }),
    example: {
      ok: true as const,
      account: {
        id: 1,
        address: "you@example.com",
        display_name: "you@example.com",
        smtp_host: "smtp.example.com",
        smtp_port: 465,
        imap_host: "imap.example.com",
        imap_port: 993,
        default_sender: true,
        enabled: true,
        password: 'vault("123", "password")',
      },
    },
  }),
  email_list_accounts: defineToolReturn({
    schema: z.object({ accounts: z.array(accountSchema) }),
    example: { accounts: [] },
  }),
  email_sync: defineToolReturn({
    schema: z.object({
      account_id: z.number(),
      upserted_messages: z.number(),
      upserted_threads: z.number(),
      highest_uid: z.number().nullable(),
    }),
    example: {
      account_id: 1,
      upserted_messages: 3,
      upserted_threads: 2,
      highest_uid: 42,
    },
  }),
  email_list: defineToolReturn({
    schema: z.object({ messages: z.array(messageSchema), count: z.number() }),
    example: { messages: [], count: 0 },
  }),
  email_read: defineToolReturn({
    schema: z.object({ message: messageSchema }),
    example: {
      message: {
        id: 1,
        account_id: 1,
        thread_id: 2,
        subject: "Hello",
        preview: "Hello world",
        body: "Hello world",
        from: "a@example.com",
        to: "b@example.com",
        sent_at: "2026-06-27T10:00:00+08:00",
        unread: false,
      },
    },
  }),
  email_send: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      messageId: z.string(),
      account_id: z.number(),
      message_entity_id: z.number(),
    }),
    example: {
      ok: true as const,
      messageId: "<id@example.com>",
      account_id: 1,
      message_entity_id: 10,
    },
  }),
};

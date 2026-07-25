import { z } from "zod";

export const EMAIL_ACCOUNT_COMPONENT = "email_account" as const;

export const emailMailboxSpecialUseSchema = z.enum([
  "inbox",
  "sent",
  "drafts",
  "trash",
  "archive",
  "junk",
]);

export type EmailMailboxSpecialUse = z.infer<typeof emailMailboxSpecialUseSchema>;

export const emailMailboxSyncCursorSchema = z.object({
  uidvalidity: z.number().int().optional(),
  last_uid: z.number().int().optional(),
  last_sync_at: z.string().optional(),
  special_use: emailMailboxSpecialUseSchema.optional(),
});

export type EmailMailboxSyncCursor = z.infer<typeof emailMailboxSyncCursorSchema>;

/** Multi-mailbox cursors; legacy single-cursor fields accepted for migrate-on-read. */
export const emailAccountSyncSchema = z.object({
  mailboxes: z.record(z.string(), emailMailboxSyncCursorSchema).optional(),
  mailbox: z.string().optional(),
  uidvalidity: z.number().int().optional(),
  last_uid: z.number().int().optional(),
  last_sync_at: z.string().optional(),
});

export const emailDeletePolicySchema = z.enum(["move_to_trash", "expunge"]);

export const emailAccountBodySchema = z.object({
  address: z.string().email(),
  password: z.string(),
  smtp_host: z.string(),
  smtp_port: z.number().int().positive(),
  imap_host: z.string(),
  imap_port: z.number().int().positive(),
  default_sender: z.boolean().default(false),
  enabled: z.boolean().default(true),
  desc: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sync: emailAccountSyncSchema.optional(),
  mailbox_paths: z.array(z.string()).optional(),
  sent_mailbox: z.string().optional(),
  trash_mailbox: z.string().optional(),
  drafts_mailbox: z.string().optional(),
  delete_policy: emailDeletePolicySchema.optional(),
});

export type EmailAccountBody = z.infer<typeof emailAccountBodySchema>;
export type EmailAccountSync = z.infer<typeof emailAccountSyncSchema>;
export type EmailDeletePolicy = z.infer<typeof emailDeletePolicySchema>;

import { z } from "zod";

export const EMAIL_ACCOUNT_COMPONENT = "email_account" as const;

export const emailAccountSyncSchema = z.object({
  mailbox: z.string().default("INBOX"),
  uidvalidity: z.number().int().optional(),
  last_uid: z.number().int().optional(),
  last_sync_at: z.string().optional(),
});

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
});

export type EmailAccountBody = z.infer<typeof emailAccountBodySchema>;
export type EmailAccountSync = z.infer<typeof emailAccountSyncSchema>;

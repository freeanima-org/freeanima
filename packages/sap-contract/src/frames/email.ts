import { z } from "zod";

export const emailAccountRowSchema = z.object({
  id: z.number().int().positive(),
  display_name: z.string(),
  address: z.string(),
  smtp_host: z.string(),
  smtp_port: z.number().int(),
  imap_host: z.string(),
  imap_port: z.number().int(),
  default_sender: z.boolean(),
  enabled: z.boolean(),
  desc: z.string().optional(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type EmailAccountRowPayload = z.infer<typeof emailAccountRowSchema>;

export const emailMessageRowSchema = z.object({
  id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  thread_id: z.number().int().positive(),
  subject: z.string(),
  preview: z.string(),
  body: z.string(),
  from: z.string(),
  to: z.string(),
  cc: z.string().nullable(),
  sent_at: z.string(),
  unread: z.boolean(),
  direction: z.enum(["inbound", "outbound"]),
  imap_uid: z.number().nullable(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type EmailMessageRowPayload = z.infer<typeof emailMessageRowSchema>;

export const emailThreadRowSchema = z.object({
  id: z.number().int().positive(),
  subject: z.string(),
  preview: z.string(),
  account_id: z.number().int().positive(),
  thread_key: z.string(),
  tags: z.array(z.string()),
  unread_count: z.number().int(),
  message_count: z.number().int(),
  last_message_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type EmailThreadRowPayload = z.infer<typeof emailThreadRowSchema>;

export const emailAccountListInputSchema = z.object({}).default({});
export type EmailAccountListInput = z.infer<typeof emailAccountListInputSchema>;
export const emailAccountListOutputSchema = z.object({
  accounts: z.array(emailAccountRowSchema),
});
export type EmailAccountListOutput = z.infer<typeof emailAccountListOutputSchema>;

export const emailMessageListInputSchema = z.object({
  account_id: z.number().int().positive().optional(),
  thread_id: z.number().int().positive().optional(),
  unread: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type EmailMessageListInput = z.infer<typeof emailMessageListInputSchema>;
export const emailMessageListOutputSchema = z.object({
  messages: z.array(emailMessageRowSchema),
});
export type EmailMessageListOutput = z.infer<typeof emailMessageListOutputSchema>;

export const emailMessageReadInputSchema = z.object({
  id: z.number().int().positive(),
});
export type EmailMessageReadInput = z.infer<typeof emailMessageReadInputSchema>;
export const emailMessageReadOutputSchema = z.object({ message: emailMessageRowSchema });
export type EmailMessageReadOutput = z.infer<typeof emailMessageReadOutputSchema>;

export const emailMessageMarkReadInputSchema = z.object({
  id: z.number().int().positive(),
});
export type EmailMessageMarkReadInput = z.infer<typeof emailMessageMarkReadInputSchema>;
export const emailMessageMarkReadOutputSchema = z.object({ ok: z.literal(true) });
export type EmailMessageMarkReadOutput = z.infer<typeof emailMessageMarkReadOutputSchema>;

export const emailSyncInputSchema = z.object({
  account_id: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});
export type EmailSyncInput = z.infer<typeof emailSyncInputSchema>;
export const emailSyncOutputSchema = z.object({
  results: z.array(
    z.object({
      account_id: z.number(),
      upserted_messages: z.number(),
      upserted_threads: z.number(),
      highest_uid: z.number().nullable(),
      error: z.string().optional(),
    }),
  ),
});
export type EmailSyncOutput = z.infer<typeof emailSyncOutputSchema>;

export const emailThreadListInputSchema = z.object({
  account_id: z.number().int().positive().optional(),
  has_unread: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
});
export type EmailThreadListInput = z.infer<typeof emailThreadListInputSchema>;
export const emailThreadListOutputSchema = z.object({
  threads: z.array(emailThreadRowSchema),
});
export type EmailThreadListOutput = z.infer<typeof emailThreadListOutputSchema>;

import { z } from "zod";

export const EMAIL_MESSAGE_COMPONENT = "email_message" as const;

export const emailDirectionSchema = z.enum(["inbound", "outbound"]);

export const emailMessageBodySchema = z.object({
  account_id: z.number().int().positive(),
  thread_id: z.number().int().positive(),
  imap_uid: z.number().int().positive().optional(),
  imap_mailbox: z.string().default("INBOX"),
  message_id: z.string().optional(),
  direction: emailDirectionSchema,
  from: z.string(),
  to: z.string(),
  cc: z.string().optional(),
  sent_at: z.string(),
  unread: z.boolean().default(true),
  flags: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
});

export type EmailMessageBody = z.infer<typeof emailMessageBodySchema>;
export type EmailDirection = z.infer<typeof emailDirectionSchema>;

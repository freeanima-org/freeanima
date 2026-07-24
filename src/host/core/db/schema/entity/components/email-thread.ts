import { z } from "zod";

export const EMAIL_THREAD_COMPONENT = "email_thread" as const;

export const emailThreadBodySchema = z.object({
  account_id: z.number().int().positive(),
  thread_key: z.string().min(1),
  tags: z.array(z.string()).default([]),
  unread_count: z.number().int().nonnegative().default(0),
  message_count: z.number().int().nonnegative().default(0),
  last_message_at: z.string().optional(),
});

export type EmailThreadBody = z.infer<typeof emailThreadBodySchema>;

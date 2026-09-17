import { EMAIL_THREAD_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { EMAIL_THREAD_COMPONENT };

import { z } from "zod";

export const emailThreadBodySchema = z.object({
  account_id: z.number().int().positive(),
  thread_key: z.string().min(1),
  unread_count: z.number().int().nonnegative().default(0),
  message_count: z.number().int().nonnegative().default(0),
  last_message_at: z.string().optional(),
});

export type EmailThreadBody = z.infer<typeof emailThreadBodySchema>;

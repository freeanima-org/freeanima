import { z } from "zod";

export const notificationRecipientKindSchema = z.enum(["user", "agent"]);
export type NotificationRecipientKind = z.infer<typeof notificationRecipientKindSchema>;

export const notificationReadFilterSchema = z.enum(["all", "unread"]);
export type NotificationReadFilter = z.infer<typeof notificationReadFilterSchema>;

export const notificationSourceKindSchema = z.enum(["system", "cron", "acp", "tool"]);
export type NotificationSourceKind = z.infer<typeof notificationSourceKindSchema>;

export const notificationRowSchema = z.object({
  id: z.string(),
  recipient_kind: notificationRecipientKindSchema,
  recipient_id: z.string(),
  title: z.string(),
  body: z.string(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
  source_kind: notificationSourceKindSchema.nullable(),
  source_ref: z.string().nullable(),
});

export type NotificationRow = z.infer<typeof notificationRowSchema>;

export const notificationListInputSchema = z.object({
  recipient_kind: notificationRecipientKindSchema,
  recipient_id: z.string().min(1).optional(),
  read_filter: notificationReadFilterSchema.optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type NotificationListInput = z.infer<typeof notificationListInputSchema>;

export const notificationListOutputSchema = z.object({
  items: z.array(notificationRowSchema),
  total: z.number().int().min(0),
  offset: z.number().int().min(0),
  limit: z.number().int().min(1),
});

export type NotificationListOutput = z.infer<typeof notificationListOutputSchema>;

export const notificationMarkReadInputSchema = z.object({
  id: z.string().min(1),
});

export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadInputSchema>;

export const notificationMarkReadOutputSchema = z.object({
  ok: z.literal(true),
  notification: notificationRowSchema,
});

export type NotificationMarkReadOutput = z.infer<typeof notificationMarkReadOutputSchema>;

export const notificationRecipientsOutputSchema = z.object({
  user_subject_id: z.string(),
  agent_subject_id: z.string(),
});

export type NotificationRecipientsOutput = z.infer<typeof notificationRecipientsOutputSchema>;

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
  tag_ids: z.array(z.number().int().positive()),
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
  content_type: z.enum(["text/plain", "text/html"]).optional(),
  from: z.string(),
  to: z.string(),
  cc: z.string().nullable(),
  sent_at: z.string(),
  unread: z.boolean(),
  flagged: z.boolean().optional(),
  direction: z.enum(["inbound", "outbound"]),
  imap_uid: z.number().nullable(),
  tag_ids: z.array(z.number().int().positive()),
  /** email.message.read：剥离后的 SMTP/MIME 头（不含 From/To/Subject/Date） */
  headers: z.record(z.string(), z.string()).optional(),
  attachments: z
    .array(
      z.object({
        file_id: z.string(),
        filename: z.string(),
        content_type: z.string(),
        size: z.number().int().nonnegative(),
        object_file_id: z.number().int().positive(),
        entity_id: z.number().int().positive(),
        content_id: z.string().optional(),
      }),
    )
    .optional(),
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
  tag_ids: z.array(z.number().int().positive()),
  unread_count: z.number().int(),
  message_count: z.number().int(),
  last_message_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type EmailThreadRowPayload = z.infer<typeof emailThreadRowSchema>;

export const emailAccountListInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export type EmailAccountListInput = z.infer<typeof emailAccountListInputSchema>;
export const emailAccountListOutputSchema = z.object({
  accounts: z.array(emailAccountRowSchema),
});
export type EmailAccountListOutput = z.infer<typeof emailAccountListOutputSchema>;

export const emailMessageListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive().optional(),
  thread_id: z.number().int().positive().optional(),
  mailbox: z.string().min(1).optional(),
  unread: z.boolean().optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type EmailMessageListInput = z.infer<typeof emailMessageListInputSchema>;
export const emailMessageListOutputSchema = z.object({
  messages: z.array(emailMessageRowSchema),
});
export type EmailMessageListOutput = z.infer<typeof emailMessageListOutputSchema>;

export const emailMessageReadInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  raw: z.boolean().optional(),
});
export type EmailMessageReadInput = z.infer<typeof emailMessageReadInputSchema>;
export const emailMessageReadOutputSchema = z.object({ message: emailMessageRowSchema });
export type EmailMessageReadOutput = z.infer<typeof emailMessageReadOutputSchema>;

export const emailMessageAttachTaskInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  due_at: z.string().nullable().optional(),
  remind_at: z.string().nullable().optional(),
  list_id: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  priority: z.enum(["high", "medium", "low", "none"]).optional(),
});
export type EmailMessageAttachTaskInput = z.infer<typeof emailMessageAttachTaskInputSchema>;
export const emailMessageAttachTaskOutputSchema = z.object({
  item: z.object({
    id: z.number().int().positive(),
    title: z.string(),
    status: z.enum(["pending", "completed"]),
    due_at: z.string().nullable(),
    remind_at: z.string().nullable(),
    list_id: z.number().int().positive().nullable(),
  }),
});
export type EmailMessageAttachTaskOutput = z.infer<typeof emailMessageAttachTaskOutputSchema>;

export const emailMessageDetachTaskInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type EmailMessageDetachTaskInput = z.infer<typeof emailMessageDetachTaskInputSchema>;
export const emailMessageDetachTaskOutputSchema = z.object({ ok: z.literal(true) });
export type EmailMessageDetachTaskOutput = z.infer<typeof emailMessageDetachTaskOutputSchema>;

export const emailMessageMarkReadInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type EmailMessageMarkReadInput = z.infer<typeof emailMessageMarkReadInputSchema>;
export const emailMessageMarkReadOutputSchema = z.object({ ok: z.literal(true) });
export type EmailMessageMarkReadOutput = z.infer<typeof emailMessageMarkReadOutputSchema>;

export const emailMessageMarkUnreadInputSchema = emailMessageMarkReadInputSchema;
export type EmailMessageMarkUnreadInput = z.infer<typeof emailMessageMarkUnreadInputSchema>;
export const emailMessageMarkUnreadOutputSchema = emailMessageMarkReadOutputSchema;
export type EmailMessageMarkUnreadOutput = z.infer<typeof emailMessageMarkUnreadOutputSchema>;

export const emailMessageDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type EmailMessageDeleteInput = z.infer<typeof emailMessageDeleteInputSchema>;
export const emailMessageDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type EmailMessageDeleteOutput = z.infer<typeof emailMessageDeleteOutputSchema>;

export const emailSendInputSchema = z.object({
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive().optional(),
  to: z.string().min(1),
  subject: z.string(),
  body: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  attachment_object_file_ids: z.array(z.number().int().positive()).max(20).optional(),
});
export type EmailSendInput = z.infer<typeof emailSendInputSchema>;
export const emailSendOutputSchema = z.object({
  ok: z.literal(true),
  messageId: z.string(),
  account_id: z.number().int().positive(),
  message_entity_id: z.number().int().positive(),
});
export type EmailSendOutput = z.infer<typeof emailSendOutputSchema>;

export const emailAttachmentUploadInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export type EmailAttachmentUploadInput = z.infer<typeof emailAttachmentUploadInputSchema>;
export const emailAttachmentUploadOutputSchema = z.object({
  object_file_id: z.number().int().positive(),
  filename: z.string().min(1),
  content_type: z.string().min(1),
  size: z.number().int().nonnegative(),
});
export type EmailAttachmentUploadOutput = z.infer<typeof emailAttachmentUploadOutputSchema>;

export const emailSyncInputSchema = z.object({
  subject_id: z.number().int().positive(),
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
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive().optional(),
  has_unread: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
});
export type EmailThreadListInput = z.infer<typeof emailThreadListInputSchema>;
export const emailThreadListOutputSchema = z.object({
  threads: z.array(emailThreadRowSchema),
});
export type EmailThreadListOutput = z.infer<typeof emailThreadListOutputSchema>;

export const emailMessageSearchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  query: z.string().optional(),
  account_id: z.number().int().positive().optional(),
  mailbox: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  unread: z.boolean().optional(),
  flagged: z.boolean().optional(),
  has_attachment: z.boolean().optional(),
  sent_after: z.string().optional(),
  sent_before: z.string().optional(),
  limit: z.number().int().positive().optional(),
});
export type EmailMessageSearchInput = z.infer<typeof emailMessageSearchInputSchema>;
export const emailMessageSearchOutputSchema = z.object({
  messages: z.array(emailMessageRowSchema),
});
export type EmailMessageSearchOutput = z.infer<typeof emailMessageSearchOutputSchema>;

export const emailProviderIdSchema = z.enum(["aliyun", "gmail", "qq", "custom"]);
export type EmailProviderId = z.infer<typeof emailProviderIdSchema>;

export const emailProviderPresetSchema = z.object({
  id: z.enum(["aliyun", "gmail", "qq"]),
  label: z.string(),
  imap_host: z.string(),
  imap_port: z.number().int().positive(),
  smtp_host: z.string(),
  smtp_port: z.number().int().positive(),
});
export type EmailProviderPresetPayload = z.infer<typeof emailProviderPresetSchema>;

export const emailProviderListInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export type EmailProviderListInput = z.infer<typeof emailProviderListInputSchema>;
export const emailProviderListOutputSchema = z.object({
  providers: z.array(emailProviderPresetSchema),
});
export type EmailProviderListOutput = z.infer<typeof emailProviderListOutputSchema>;

const emailAccountHostFields = {
  provider: emailProviderIdSchema.optional(),
  smtp_host: z.string().min(1).optional(),
  smtp_port: z.number().int().positive().optional(),
  imap_host: z.string().min(1).optional(),
  imap_port: z.number().int().positive().optional(),
};

export const emailAccountCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  password: z.string().min(1),
  address: z.string().email(),
  display_name: z.string().optional(),
  default_sender: z.boolean().optional(),
  enabled: z.boolean().optional(),
  desc: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  ...emailAccountHostFields,
});
export type EmailAccountCreateInput = z.infer<typeof emailAccountCreateInputSchema>;
export const emailAccountCreateOutputSchema = z.object({ account: emailAccountRowSchema });
export type EmailAccountCreateOutput = z.infer<typeof emailAccountCreateOutputSchema>;

export const emailAccountPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  password: z.string().min(1).optional(),
  address: z.string().email().optional(),
  display_name: z.string().optional(),
  default_sender: z.boolean().optional(),
  enabled: z.boolean().optional(),
  desc: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  ...emailAccountHostFields,
});
export type EmailAccountPatchInput = z.infer<typeof emailAccountPatchInputSchema>;
export const emailAccountPatchOutputSchema = z.object({ account: emailAccountRowSchema });
export type EmailAccountPatchOutput = z.infer<typeof emailAccountPatchOutputSchema>;

export const emailAccountDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type EmailAccountDeleteInput = z.infer<typeof emailAccountDeleteInputSchema>;
export const emailAccountDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type EmailAccountDeleteOutput = z.infer<typeof emailAccountDeleteOutputSchema>;

export const emailMailboxInfoSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  special_use: z.array(z.string()).optional(),
  subscribed: z.boolean().optional(),
});

export const emailMailboxListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
});
export type EmailMailboxListInput = z.infer<typeof emailMailboxListInputSchema>;
export const emailMailboxListOutputSchema = z.object({
  mailboxes: z.array(emailMailboxInfoSchema),
});
export type EmailMailboxListOutput = z.infer<typeof emailMailboxListOutputSchema>;

export const emailMailboxCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  path: z.string().min(1),
});
export type EmailMailboxCreateInput = z.infer<typeof emailMailboxCreateInputSchema>;
export const emailMailboxCreateOutputSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  mailboxes: z.array(emailMailboxInfoSchema),
});
export type EmailMailboxCreateOutput = z.infer<typeof emailMailboxCreateOutputSchema>;

export const emailMailboxRenameInputSchema = z.object({
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  from: z.string().min(1),
  to: z.string().min(1),
});
export type EmailMailboxRenameInput = z.infer<typeof emailMailboxRenameInputSchema>;
export const emailMailboxRenameOutputSchema = z.object({
  ok: z.literal(true),
  from: z.string(),
  to: z.string(),
  mailboxes: z.array(emailMailboxInfoSchema),
});
export type EmailMailboxRenameOutput = z.infer<typeof emailMailboxRenameOutputSchema>;

export const emailMailboxDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  path: z.string().min(1),
});
export type EmailMailboxDeleteInput = z.infer<typeof emailMailboxDeleteInputSchema>;
export const emailMailboxDeleteOutputSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  mailboxes: z.array(emailMailboxInfoSchema),
});
export type EmailMailboxDeleteOutput = z.infer<typeof emailMailboxDeleteOutputSchema>;

export const emailMessageMoveInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  target_mailbox: z.string().min(1),
});
export type EmailMessageMoveInput = z.infer<typeof emailMessageMoveInputSchema>;
export const emailMessageMoveOutputSchema = z.object({
  ok: z.literal(true),
  imap_uid: z.number().nullable(),
});
export type EmailMessageMoveOutput = z.infer<typeof emailMessageMoveOutputSchema>;

export const emailMessageMarkFlaggedInputSchema = emailMessageMarkReadInputSchema;
export type EmailMessageMarkFlaggedInput = z.infer<typeof emailMessageMarkFlaggedInputSchema>;
export const emailMessageMarkFlaggedOutputSchema = emailMessageMarkReadOutputSchema;
export type EmailMessageMarkFlaggedOutput = z.infer<typeof emailMessageMarkFlaggedOutputSchema>;

export const emailMessageMarkUnflaggedInputSchema = emailMessageMarkReadInputSchema;
export type EmailMessageMarkUnflaggedInput = z.infer<typeof emailMessageMarkUnflaggedInputSchema>;
export const emailMessageMarkUnflaggedOutputSchema = emailMessageMarkReadOutputSchema;
export type EmailMessageMarkUnflaggedOutput = z.infer<typeof emailMessageMarkUnflaggedOutputSchema>;

export const emailDraftSaveInputSchema = z.object({
  subject_id: z.number().int().positive(),
  account_id: z.number().int().positive().optional(),
  message_id: z.number().int().positive().optional(),
  to: z.string().optional(),
  subject: z.string(),
  body: z.string(),
});
export type EmailDraftSaveInput = z.infer<typeof emailDraftSaveInputSchema>;
export const emailDraftSaveOutputSchema = z.object({
  ok: z.literal(true),
  message_entity_id: z.number().int().positive(),
  imap_uid: z.number().nullable(),
});
export type EmailDraftSaveOutput = z.infer<typeof emailDraftSaveOutputSchema>;

export const emailDraftSendInputSchema = z.object({
  subject_id: z.number().int().positive(),
  message_id: z.number().int().positive(),
});
export type EmailDraftSendInput = z.infer<typeof emailDraftSendInputSchema>;
export const emailDraftSendOutputSchema = z.object({
  ok: z.literal(true),
  messageId: z.string(),
  message_entity_id: z.number().int().positive(),
});
export type EmailDraftSendOutput = z.infer<typeof emailDraftSendOutputSchema>;

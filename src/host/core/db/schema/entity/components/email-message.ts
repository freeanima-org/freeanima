import { z } from "zod";

export const EMAIL_MESSAGE_COMPONENT = "email_message" as const;

export const emailDirectionSchema = z.enum(["inbound", "outbound"]);

export const emailContentTypeSchema = z.enum(["text/plain", "text/html"]);

export const emailMessageAttachmentMetaSchema = z.object({
  file_id: z.string().min(1),
  filename: z.string().min(1),
  content_type: z.string().min(1),
  size: z.number().int().nonnegative(),
  path: z.string().min(1),
  content_id: z.string().optional(),
});

export type EmailMessageAttachmentMeta = z.infer<typeof emailMessageAttachmentMetaSchema>;

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
  /** 解码后正文的 MIME 类型（content 列）；html 时 UI 沙箱渲染 */
  content_type: emailContentTypeSchema.default("text/plain"),
  /** 始终为纯文本（ToolSet 默认 / preview） */
  text: z.string().optional(),
  /** SMTP/MIME 头（小写键）；常用 From/To/Subject/Date 仍在实体字段 */
  headers: z.record(z.string(), z.string()).optional(),
  attachments: z.array(emailMessageAttachmentMetaSchema).optional(),
});

export type EmailMessageBody = z.infer<typeof emailMessageBodySchema>;
export type EmailDirection = z.infer<typeof emailDirectionSchema>;
export type EmailContentType = z.infer<typeof emailContentTypeSchema>;

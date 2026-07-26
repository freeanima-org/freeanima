import type { EmailAccountBody } from "@freeanima/host/core/db/schema/entity";

export type {
  EmailAccountRowPayload,
  EmailMessageRowPayload,
  EmailThreadRowPayload,
} from "@freeanima/shared/rpc-contract";

/** Entity store row (includes credential path fields not exposed on Habitat RPC protocol). */
export type EmailAccountRow = import("@freeanima/shared/rpc-contract").EmailAccountRowPayload & {
  password: string;
  sync?: import("@freeanima/host/core/db/schema/entity").EmailAccountSync;
  mailbox_paths?: string[];
  sent_mailbox?: string;
  trash_mailbox?: string;
  drafts_mailbox?: string;
  delete_policy?: "move_to_trash" | "expunge";
};

export type EmailThreadRow = import("@freeanima/shared/rpc-contract").EmailThreadRowPayload;

export type EmailMessageRow = Omit<
  import("@freeanima/shared/rpc-contract").EmailMessageRowPayload,
  "headers" | "attachments" | "content_type" | "body"
> & {
  /** 解码后正文（content raw：plain 或 html） */
  body: string;
  content_type: import("@freeanima/host/core/db/schema/entity").EmailContentType;
  /** 纯文本（ToolSet 默认） */
  text: string;
  imap_mailbox: string;
  message_id: string | null;
  flags: string[];
  headers: Record<string, string> | null;
  attachments: import("@freeanima/host/core/db/schema/entity").EmailMessageAttachmentMeta[];
};

export type EmailAccountCreateInput = {
  password: string;
  address: string;
  display_name?: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  default_sender?: boolean;
  enabled?: boolean;
  desc?: string;
  tags?: string[];
};

export type EmailAccountUpdateInput = {
  id: number;
  password?: string;
  address?: string;
  display_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  imap_host?: string;
  imap_port?: number;
  default_sender?: boolean;
  enabled?: boolean;
  desc?: string;
  tags?: string[];
  sync?: EmailAccountBody["sync"];
  mailbox_paths?: string[];
  sent_mailbox?: string | null;
  trash_mailbox?: string | null;
  drafts_mailbox?: string | null;
  delete_policy?: "move_to_trash" | "expunge";
};

export type EmailThreadUpsertInput = {
  account_id: number;
  thread_key: string;
  subject: string;
  preview: string;
  last_message_at: string;
  unread_delta?: number;
  message_delta?: number;
  tags?: string[];
};

export type EmailMessageUpsertInput = {
  account_id: number;
  thread_id: number;
  subject: string;
  preview: string;
  /** 解码后正文 raw（优先 html，否则 plain）→ entity content */
  body: string;
  content_type?: import("@freeanima/host/core/db/schema/entity").EmailContentType;
  /** 纯文本 */
  text?: string | null;
  headers?: Record<string, string> | null;
  attachments?: import("@freeanima/host/core/db/schema/entity").EmailMessageAttachmentMeta[];
  imap_uid?: number | null;
  imap_mailbox?: string;
  message_id?: string | null;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  cc?: string | null;
  sent_at: string;
  unread?: boolean;
  flags?: string[];
  tags?: string[];
};

export type EmailMessageListOpts = {
  account_id?: number;
  thread_id?: number;
  imap_mailbox?: string;
  unread?: boolean;
  flagged?: boolean;
  direction?: "inbound" | "outbound";
  tags?: string[];
  since?: string;
  before?: string;
  limit?: number;
  offset?: number;
};

export type EmailThreadListOpts = {
  account_id?: number;
  tags?: string[];
  has_unread?: boolean;
  limit?: number;
  offset?: number;
};

export type EmailSyncResult = {
  account_id: number;
  /** 账户所属 world（自动同步通知按此路由收件人） */
  world_id: number;
  upserted_messages: number;
  upserted_threads: number;
  highest_uid: number | null;
  /** 本次新入库的收件箱邮件标题（用于自动同步通知） */
  new_subjects: string[];
  error?: string;
};

export type EmailTagTarget = "thread" | "message";

import type { EmailAccountBody } from "@freeanima/core/db/schema/entity";

export type EmailAccountRow = {
  id: number;
  display_name: string;
  address: string;
  password: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  default_sender: boolean;
  enabled: boolean;
  desc?: string;
  tags: string[];
  sync: EmailAccountBody["sync"];
  created_at: string;
  updated_at: string;
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
};

export type EmailThreadRow = {
  id: number;
  subject: string;
  preview: string;
  account_id: number;
  thread_key: string;
  tags: string[];
  unread_count: number;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
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

export type EmailMessageRow = {
  id: number;
  subject: string;
  preview: string;
  body: string;
  account_id: number;
  thread_id: number;
  imap_uid: number | null;
  imap_mailbox: string;
  message_id: string | null;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  cc: string | null;
  sent_at: string;
  unread: boolean;
  flags: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type EmailMessageUpsertInput = {
  account_id: number;
  thread_id: number;
  subject: string;
  preview: string;
  body: string;
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
  unread?: boolean;
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
  upserted_messages: number;
  upserted_threads: number;
  highest_uid: number | null;
  error?: string;
};

export type EmailTagTarget = "thread" | "message";

import type { EmailAccountBody } from "@freeanima/core/db/schema/entity";

export type {
  EmailAccountRowPayload,
  EmailMessageRowPayload,
  EmailThreadRowPayload,
} from "@freeanima/sap-contract";

/** Entity store row (includes credential path fields not exposed on SAP wire). */
export type EmailAccountRow = import("@freeanima/sap-contract").EmailAccountRowPayload & {
  password: string;
  sync: EmailAccountBody["sync"];
};

export type EmailThreadRow = import("@freeanima/sap-contract").EmailThreadRowPayload;

export type EmailMessageRow = import("@freeanima/sap-contract").EmailMessageRowPayload & {
  imap_mailbox: string;
  message_id: string | null;
  flags: string[];
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

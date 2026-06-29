import { z } from "@freeanima/core/tool";

import type { listEmailAccountRows } from "./account-store.ts";
import type { getEmailMessageRow } from "./message-store.ts";

export const accountCreateSchema = z.object({
  password: z.string().min(1),
  address: z.string().email(),
  display_name: z.string().optional(),
  smtp_host: z.string().min(1),
  smtp_port: z.number().int().positive(),
  imap_host: z.string().min(1),
  imap_port: z.number().int().positive(),
  default_sender: z.boolean().optional(),
  enabled: z.boolean().optional(),
  desc: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const accountPatchSchema = accountCreateSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z.string().min(1).optional(),
  });

export type EmailToolIo = {
  sendEmail: (input: {
    account_id?: number;
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
  }) => Promise<unknown>;
  markAsRead: (messageId: number) => Promise<unknown>;
  deleteEmail: (messageId: number) => Promise<unknown>;
  assertPasswordResolvable: (account: { password: string }) => Promise<void>;
};

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function accountPayload(account: Awaited<ReturnType<typeof listEmailAccountRows>>[number]) {
  return {
    id: account.id,
    address: account.address,
    display_name: account.display_name,
    smtp_host: account.smtp_host,
    smtp_port: account.smtp_port,
    imap_host: account.imap_host,
    imap_port: account.imap_port,
    default_sender: account.default_sender,
    enabled: account.enabled,
    desc: account.desc,
    tags: account.tags,
    password: account.password,
    sync: account.sync,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export function messagePayload(
  message: NonNullable<Awaited<ReturnType<typeof getEmailMessageRow>>>,
) {
  return {
    id: message.id,
    account_id: message.account_id,
    thread_id: message.thread_id,
    subject: message.subject,
    preview: message.preview,
    body: message.body,
    from: message.from,
    to: message.to,
    cc: message.cc,
    sent_at: message.sent_at,
    unread: message.unread,
    direction: message.direction,
    imap_uid: message.imap_uid,
    tags: message.tags,
  };
}

export function parseAccountId(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function parseMessageId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

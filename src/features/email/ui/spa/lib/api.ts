import { getSubjectKind } from "@freeanima/client/portal-sdk";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { omitUndefined } from "@freeanima/host/core/util";

export type EmailAccountRow = {
  id: number;
  display_name: string;
  address: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  default_sender: boolean;
  enabled: boolean;
  desc?: string | undefined;
  tag_ids: number[];
  created_at: string;
  updated_at: string;
};

export type EmailMailboxInfo = {
  path: string;
  name?: string | undefined;
  special_use?: string[] | undefined;
  subscribed?: boolean | undefined;
};

export type EmailProviderPreset = {
  id: "aliyun" | "gmail" | "qq";
  label: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
};

export type EmailProviderId = "aliyun" | "gmail" | "qq" | "custom";

export type EmailMessageRow = {
  id: number;
  account_id: number;
  thread_id: number;
  subject: string;
  preview: string;
  body: string;
  content_type?: "text/plain" | "text/html";
  from: string;
  to: string;
  sent_at: string;
  unread: boolean;
  flagged: boolean;
  direction: "inbound" | "outbound";
  imap_mailbox?: string;
  tag_ids: number[];
};

function toUiMessage(row: {
  id: number;
  account_id: number;
  thread_id: number;
  subject: string;
  preview: string;
  body: string;
  content_type?: "text/plain" | "text/html" | undefined;
  from: string;
  to: string;
  sent_at: string;
  unread: boolean;
  flagged?: boolean | undefined;
  direction: "inbound" | "outbound";
  imap_uid?: number | null;
  tag_ids: number[];
}): EmailMessageRow {
  return {
    id: row.id,
    account_id: row.account_id,
    thread_id: row.thread_id,
    subject: row.subject,
    preview: row.preview,
    body: row.body,
    from: row.from,
    to: row.to,
    sent_at: row.sent_at,
    unread: row.unread,
    flagged: row.flagged === true,
    direction: row.direction,
    tag_ids: row.tag_ids,
    ...(row.content_type != null ? { content_type: row.content_type } : {}),
  };
}

export type EmailAccountCreateInput = {
  password: string;
  address: string;
  display_name?: string;
  provider?: EmailProviderId;
  smtp_host?: string;
  smtp_port?: number;
  imap_host?: string;
  imap_port?: number;
  default_sender?: boolean;
  enabled?: boolean;
  desc?: string;
  tag_ids?: number[];
};

export type EmailAccountPatchInput = {
  id: number;
  password?: string;
  address?: string;
  display_name?: string;
  provider?: EmailProviderId;
  smtp_host?: string;
  smtp_port?: number;
  imap_host?: string;
  imap_port?: number;
  default_sender?: boolean;
  enabled?: boolean;
  desc?: string;
  tag_ids?: number[];
};

function habitat() {
  return getTypedHabitatClient();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

function accountsCacheId(): string {
  return `accounts:${getSubjectKind()}`;
}

async function invalidateAccountsCache(): Promise<void> {
  await invalidatePortalReads(["email", "accounts"]);
}

export async function fetchEmailAccounts(): Promise<EmailAccountRow[]> {
  const scope = resolveHabitatCacheScope();
  const cacheId = accountsCacheId();
  return withOfflineCache({
    scope,
    namespace: "email",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call("emailaccount.list", withSubjectKind({}));
      return data.accounts;
    },
    offlineError: "emailaccount.list unavailable offline",
  });
}

export async function fetchEmailProviders(): Promise<EmailProviderPreset[]> {
  const data = await habitat().call("emailprovider.list", withSubjectKind({}));
  return data.providers;
}

export async function createEmailAccount(input: EmailAccountCreateInput): Promise<EmailAccountRow> {
  const data = await habitat().call("emailaccount.create", withSubjectKind(input));
  await invalidateAccountsCache();
  return data.account;
}

export async function patchEmailAccount(input: EmailAccountPatchInput): Promise<EmailAccountRow> {
  const data = await habitat().call("emailaccount.patch", withSubjectKind(input));
  await invalidateAccountsCache();
  return data.account;
}

export async function deleteEmailAccount(id: number): Promise<void> {
  await habitat().call("emailaccount.delete", withSubjectKind({ id }));
  await invalidateAccountsCache();
}

export async function fetchEmailMailboxes(accountId: number): Promise<EmailMailboxInfo[]> {
  const data = await habitat().call(
    "email.mailbox.list",
    withSubjectKind({ account_id: accountId }),
  );
  return data.mailboxes;
}

export async function createEmailMailbox(
  accountId: number,
  path: string,
): Promise<EmailMailboxInfo[]> {
  const data = await habitat().call(
    "email.mailbox.create",
    withSubjectKind({ account_id: accountId, path }),
  );
  return data.mailboxes;
}

export async function renameEmailMailbox(
  accountId: number,
  from: string,
  to: string,
): Promise<EmailMailboxInfo[]> {
  const data = await habitat().call(
    "email.mailbox.rename",
    withSubjectKind({ account_id: accountId, from, to }),
  );
  return data.mailboxes;
}

export async function deleteEmailMailbox(
  accountId: number,
  path: string,
): Promise<EmailMailboxInfo[]> {
  const data = await habitat().call(
    "email.mailbox.delete",
    withSubjectKind({ account_id: accountId, path }),
  );
  return data.mailboxes;
}

export async function fetchEmailMessages(input: {
  account_id?: number;
  thread_id?: number;
  mailbox?: string;
  unread?: boolean;
  flagged?: boolean;
  direction?: "inbound" | "outbound";
  limit?: number;
}): Promise<EmailMessageRow[]> {
  const data = await habitat().call("email.message.list", withSubjectKind(omitUndefined(input)));
  return data.messages.map(toUiMessage);
}

export async function readEmailMessage(
  id: number,
  opts: { raw?: boolean } = {},
): Promise<EmailMessageRow> {
  const data = await habitat().call(
    "email.message.read",
    withSubjectKind({ id, ...(opts.raw === true ? { raw: true } : {}) }),
  );
  return toUiMessage(data.message);
}

export async function markEmailMessageRead(id: number): Promise<void> {
  await habitat().call("email.message.markRead", withSubjectKind({ id }));
}

export async function markEmailMessageUnread(id: number): Promise<void> {
  await habitat().call("email.message.markUnread", withSubjectKind({ id }));
}

export async function markEmailMessageFlagged(id: number): Promise<void> {
  await habitat().call("email.message.markFlagged", withSubjectKind({ id }));
}

export async function markEmailMessageUnflagged(id: number): Promise<void> {
  await habitat().call("email.message.markUnflagged", withSubjectKind({ id }));
}

export async function moveEmailMessage(id: number, targetMailbox: string): Promise<void> {
  await habitat().call(
    "email.message.move",
    withSubjectKind({ id, target_mailbox: targetMailbox }),
  );
}

export async function deleteEmailMessage(id: number): Promise<void> {
  await habitat().call("email.message.delete", withSubjectKind({ id }));
}

export async function sendEmailMessage(input: {
  account_id?: number;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): Promise<{ messageId: string; account_id: number; message_entity_id: number }> {
  const data = await habitat().call("email.send", withSubjectKind(omitUndefined(input)));
  return {
    messageId: data.messageId,
    account_id: data.account_id,
    message_entity_id: data.message_entity_id,
  };
}

export async function saveEmailDraft(input: {
  account_id?: number;
  message_id?: number;
  to?: string;
  subject: string;
  body: string;
}): Promise<{ message_entity_id: number }> {
  const data = await habitat().call("email.draft.save", withSubjectKind(omitUndefined(input)));
  return { message_entity_id: data.message_entity_id };
}

export type EmailSyncResult = {
  account_id: number;
  world_id?: number;
  upserted_messages: number;
  upserted_threads: number;
  highest_uid: number | null;
  error?: string;
};

export async function syncEmailAccount(
  accountId?: number,
  limit = 100,
): Promise<EmailSyncResult[]> {
  const data = await habitat().call(
    "email.sync",
    withSubjectKind(omitUndefined({ account_id: accountId, limit })),
  );
  const results = data.results;
  const failed = results.filter((row) => row.error);
  if (failed.length > 0) {
    throw new Error(failed.map((row) => row.error).join("; "));
  }
  return results.map((row) => ({
    account_id: row.account_id,
    upserted_messages: row.upserted_messages,
    upserted_threads: row.upserted_threads,
    highest_uid: row.highest_uid,
    ...(row.error !== undefined ? { error: row.error } : {}),
  }));
}

export type EmailSearchInput = {
  query?: string;
  account_id?: number;
  mailbox?: string;
  from?: string;
  to?: string;
  subject?: string;
  unread?: boolean;
  flagged?: boolean;
  has_attachment?: boolean;
  sent_after?: string;
  sent_before?: string;
  limit?: number;
};

export async function searchEmailMessages(input: EmailSearchInput): Promise<EmailMessageRow[]> {
  const data = await habitat().call("email.message.search", withSubjectKind(omitUndefined(input)));
  return data.messages.map(toUiMessage);
}

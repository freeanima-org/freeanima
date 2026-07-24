import { getSubjectKind } from "@freeanima/frontend/portal-sdk";
import {
  readOfflineCache,
  resolveHabitatCacheScope,
  writeOfflineCache,
} from "@freeanima/frontend/portal-sdk/offline-cache";

import { getTypedHabitatClient } from "@freeanima/platform/habitat/client.ts";

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
  tags: string[];
  created_at: string;
  updated_at: string;
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
  direction: "inbound" | "outbound";
  tags: string[];
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
  direction: "inbound" | "outbound";
  tags: string[];
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
    direction: row.direction,
    tags: row.tags,
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
  tags?: string[];
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
  tags?: string[];
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

function messagesCacheId(input: {
  account_id?: number;
  thread_id?: number;
  unread?: boolean;
  direction?: "inbound" | "outbound";
  limit?: number;
}): string {
  return `messages:${JSON.stringify(input)}`;
}

function messageCacheId(id: number): string {
  return `message:${getSubjectKind()}:${id}`;
}

function searchCacheId(input: { query: string; account_id?: number; limit?: number }): string {
  return `search:${JSON.stringify(input)}`;
}

async function invalidateAccountsCache(): Promise<void> {
  const scope = resolveHabitatCacheScope();
  await writeOfflineCache(scope, "email", accountsCacheId(), null as unknown as EmailAccountRow[]);
}

export async function fetchEmailAccounts(): Promise<EmailAccountRow[]> {
  const scope = resolveHabitatCacheScope();
  const cacheId = accountsCacheId();
  const cached = await readOfflineCache<EmailAccountRow[]>(scope, "email", cacheId);
  try {
    const data = await habitat().call("emailaccount.list", withSubjectKind({}));
    void writeOfflineCache(scope, "email", cacheId, data.accounts);
    return data.accounts;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
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

export async function fetchEmailMessages(input: {
  account_id?: number;
  thread_id?: number;
  unread?: boolean;
  direction?: "inbound" | "outbound";
  limit?: number;
}): Promise<EmailMessageRow[]> {
  const scope = resolveHabitatCacheScope();
  const cacheId = messagesCacheId(input);
  const cached = await readOfflineCache<EmailMessageRow[]>(scope, "email", cacheId);
  try {
    const data = await habitat().call("email.message.list", withSubjectKind(input));
    const messages = data.messages.map(toUiMessage);
    void writeOfflineCache(scope, "email", cacheId, messages);
    return messages;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function readEmailMessage(
  id: number,
  opts: { raw?: boolean } = {},
): Promise<EmailMessageRow> {
  const scope = resolveHabitatCacheScope();
  const cacheId = `${messageCacheId(id)}:raw=${opts.raw === true ? 1 : 0}`;
  const cached = await readOfflineCache<EmailMessageRow>(scope, "email", cacheId);
  try {
    const data = await habitat().call(
      "email.message.read",
      withSubjectKind({ id, ...(opts.raw === true ? { raw: true } : {}) }),
    );
    const message = toUiMessage(data.message);
    void writeOfflineCache(scope, "email", cacheId, message);
    return message;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function markEmailMessageRead(id: number): Promise<void> {
  await habitat().call("email.message.markRead", withSubjectKind({ id }));
}

export async function markEmailMessageUnread(id: number): Promise<void> {
  await habitat().call("email.message.markUnread", withSubjectKind({ id }));
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
  const data = await habitat().call("email.send", withSubjectKind(input));
  return {
    messageId: data.messageId,
    account_id: data.account_id,
    message_entity_id: data.message_entity_id,
  };
}

export type EmailSyncResult = {
  account_id: number;
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
    withSubjectKind({ account_id: accountId, limit }),
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

export async function searchEmailMessages(input: {
  query: string;
  account_id?: number;
  limit?: number;
}): Promise<EmailMessageRow[]> {
  const scope = resolveHabitatCacheScope();
  const cacheId = searchCacheId(input);
  const cached = await readOfflineCache<EmailMessageRow[]>(scope, "email", cacheId);
  try {
    const data = await habitat().call(
      "email.message.search",
      withSubjectKind({
        query: input.query,
        account_id: input.account_id,
        limit: input.limit,
      }),
    );
    const messages = data.messages.map(toUiMessage);
    void writeOfflineCache(scope, "email", cacheId, messages);
    return messages;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

import { getSubjectKind } from "@freeanima/frontend/shell-sdk";
import {
  readOfflineCache,
  resolveHubCacheScope,
  writeOfflineCache,
} from "@freeanima/frontend/shell-sdk/offline-cache";

import { getEmailHubClient } from "./hub-client.ts";

export type EmailAccountRow = {
  id: number;
  display_name: string;
  address: string;
  default_sender: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailMessageRow = {
  id: number;
  account_id: number;
  thread_id: number;
  subject: string;
  preview: string;
  body: string;
  from: string;
  to: string;
  sent_at: string;
  unread: boolean;
  direction: "inbound" | "outbound";
  tags: string[];
};

function hub() {
  return getEmailHubClient();
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

export async function fetchEmailAccounts(): Promise<EmailAccountRow[]> {
  const scope = resolveHubCacheScope();
  const cacheId = accountsCacheId();
  const cached = await readOfflineCache<EmailAccountRow[]>(scope, "email", cacheId);
  try {
    const data = await hub().call("emailaccount.list", withSubjectKind({}));
    void writeOfflineCache(scope, "email", cacheId, data.accounts);
    return data.accounts;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function fetchEmailMessages(input: {
  account_id?: number;
  thread_id?: number;
  unread?: boolean;
  limit?: number;
}): Promise<EmailMessageRow[]> {
  const scope = resolveHubCacheScope();
  const cacheId = messagesCacheId(input);
  const cached = await readOfflineCache<EmailMessageRow[]>(scope, "email", cacheId);
  try {
    const data = await hub().call("email.message.list", withSubjectKind(input));
    void writeOfflineCache(scope, "email", cacheId, data.messages);
    return data.messages;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function readEmailMessage(id: number): Promise<EmailMessageRow> {
  const scope = resolveHubCacheScope();
  const cacheId = messageCacheId(id);
  const cached = await readOfflineCache<EmailMessageRow>(scope, "email", cacheId);
  try {
    const data = await hub().call("email.message.read", withSubjectKind({ id }));
    void writeOfflineCache(scope, "email", cacheId, data.message);
    return data.message;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function markEmailMessageRead(id: number): Promise<void> {
  await hub().call("email.message.markRead", withSubjectKind({ id }));
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
  const data = await hub().call("email.sync", withSubjectKind({ account_id: accountId, limit }));
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
  const scope = resolveHubCacheScope();
  const cacheId = searchCacheId(input);
  const cached = await readOfflineCache<EmailMessageRow[]>(scope, "email", cacheId);
  try {
    const data = await hub().call(
      "email.message.search",
      withSubjectKind({
        query: input.query,
        account_id: input.account_id,
        limit: input.limit,
      }),
    );
    const messages = data.messages.map((row) => ({
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
    }));
    void writeOfflineCache(scope, "email", cacheId, messages);
    return messages;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

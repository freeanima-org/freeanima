import { getCachedUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { omitUndefined } from "@freeanima/shared/util";
import { parseHabitatRestResponse } from "@freeanima/shared/habitat-rpc";

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

export type EmailAttachmentRow = {
  file_id: string;
  filename: string;
  content_type: string;
  size: number;
  object_file_id: number;
  entity_id: number;
  content_id?: string | undefined;
};

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
  attachments?: EmailAttachmentRow[];
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
  attachments?:
    | Array<{
        file_id: string;
        filename: string;
        content_type: string;
        size: number;
        object_file_id: number;
        entity_id: number;
        content_id?: string | undefined;
      }>
    | undefined;
}): EmailMessageRow {
  const attachments = row.attachments?.map((a) => ({
    file_id: a.file_id,
    filename: a.filename,
    content_type: a.content_type,
    size: a.size,
    object_file_id: a.object_file_id,
    entity_id: a.entity_id,
    ...(a.content_id != null && a.content_id !== "" ? { content_id: a.content_id } : {}),
  }));
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
    ...(attachments != null && attachments.length > 0 ? { attachments } : {}),
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

function withSubject<T extends Record<string, unknown>>(payload: T) {
  return { subject_id: getCachedUserSubjectId(), ...payload };
}

function accountsCacheId(): string {
  return `accounts:${getCachedUserSubjectId()}`;
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
      const data = await habitat().call("emailaccount.list", withSubject({}));
      return data.accounts;
    },
    offlineError: "emailaccount.list unavailable offline",
  });
}

export async function fetchEmailProviders(): Promise<EmailProviderPreset[]> {
  const data = await habitat().call("emailprovider.list", withSubject({}));
  return data.providers;
}

export async function createEmailAccount(input: EmailAccountCreateInput): Promise<EmailAccountRow> {
  const data = await habitat().call("emailaccount.create", withSubject(input));
  await invalidateAccountsCache();
  return data.account;
}

export async function patchEmailAccount(input: EmailAccountPatchInput): Promise<EmailAccountRow> {
  const data = await habitat().call("emailaccount.patch", withSubject(input));
  await invalidateAccountsCache();
  return data.account;
}

export async function deleteEmailAccount(id: number): Promise<void> {
  await habitat().call("emailaccount.delete", withSubject({ id }));
  await invalidateAccountsCache();
}

export async function fetchEmailMailboxes(accountId: number): Promise<EmailMailboxInfo[]> {
  const data = await habitat().call("email.mailbox.list", withSubject({ account_id: accountId }));
  return data.mailboxes;
}

export async function createEmailMailbox(
  accountId: number,
  path: string,
): Promise<EmailMailboxInfo[]> {
  const data = await habitat().call(
    "email.mailbox.create",
    withSubject({ account_id: accountId, path }),
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
    withSubject({ account_id: accountId, from, to }),
  );
  return data.mailboxes;
}

export async function deleteEmailMailbox(
  accountId: number,
  path: string,
): Promise<EmailMailboxInfo[]> {
  const data = await habitat().call(
    "email.mailbox.delete",
    withSubject({ account_id: accountId, path }),
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
  const data = await habitat().call("email.message.list", withSubject(omitUndefined(input)));
  return data.messages.map(toUiMessage);
}

export async function readEmailMessage(
  id: number,
  opts: { raw?: boolean } = {},
): Promise<EmailMessageRow> {
  const data = await habitat().call(
    "email.message.read",
    withSubject({ id, ...(opts.raw === true ? { raw: true } : {}) }),
  );
  return toUiMessage(data.message);
}

/** 经对象存储下载邮件附件字节。 */
export async function downloadEmailAttachmentBytes(objectFileId: number): Promise<Blob> {
  const res = await habitat().callRaw("object_storage.file.get", { id: objectFileId });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.blob();
}

export async function markEmailMessageRead(id: number): Promise<void> {
  await habitat().call("email.message.markRead", withSubject({ id }));
}

export async function markEmailMessageUnread(id: number): Promise<void> {
  await habitat().call("email.message.markUnread", withSubject({ id }));
}

export async function markEmailMessageFlagged(id: number): Promise<void> {
  await habitat().call("email.message.markFlagged", withSubject({ id }));
}

export async function markEmailMessageUnflagged(id: number): Promise<void> {
  await habitat().call("email.message.markUnflagged", withSubject({ id }));
}

export async function moveEmailMessage(id: number, targetMailbox: string): Promise<void> {
  await habitat().call("email.message.move", withSubject({ id, target_mailbox: targetMailbox }));
}

export async function deleteEmailMessage(id: number): Promise<void> {
  await habitat().call("email.message.delete", withSubject({ id }));
}

export async function attachTaskToEmail(
  id: number,
  input: { due_at?: string | null; remind_at?: string | null; title?: string } = {},
): Promise<{ id: number; title: string; due_at: string | null; remind_at: string | null }> {
  const data = await habitat().call(
    "email.message.attachTask",
    withSubject(omitUndefined({ id, ...input })),
  );
  return data.item;
}

export async function detachTaskFromEmail(id: number): Promise<void> {
  await habitat().call("email.message.detachTask", withSubject({ id }));
}

/** 探测邮件是否已挂 task_item（同 id） */
export async function emailHasAttachedTask(id: number): Promise<boolean> {
  try {
    const data = await habitat().call("task.get", withSubject({ id }));
    return data.item != null;
  } catch {
    return false;
  }
}

export async function sendEmailMessage(input: {
  account_id?: number;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachment_object_file_ids?: number[];
}): Promise<{ messageId: string; account_id: number; message_entity_id: number }> {
  const data = await habitat().call("email.send", withSubject(omitUndefined(input)));
  return {
    messageId: data.messageId,
    account_id: data.account_id,
    message_entity_id: data.message_entity_id,
  };
}

/** 上传本地文件为邮件附件 object_file（multipart）。 */
export async function uploadEmailAttachment(file: File): Promise<{
  object_file_id: number;
  filename: string;
  content_type: string;
  size: number;
}> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await habitat().callRaw("email.attachment.upload", withSubject({}), {
    body: form,
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
  const body = (await parseHabitatRestResponse(res)) as {
    object_file_id: number;
    filename: string;
    content_type: string;
    size: number;
  };
  return body;
}

export type EmailObjectLibraryItem = {
  id: number;
  title: string;
  updated_at: string;
};

/** 列本 subject world 内 object_file，供发信从对象库选择。 */
export async function listObjectFilesForAttach(opts?: {
  query?: string;
  limit?: number;
}): Promise<EmailObjectLibraryItem[]> {
  const data = await habitat().call(
    "entity.list",
    withSubject({
      primary_component: "object_file",
      type: "content",
      limit: opts?.limit ?? 50,
      ...(opts?.query?.trim() ? { query: opts.query.trim() } : {}),
    }),
  );
  return data.items.map((item) => ({
    id: item.id,
    title: item.title || `object_file #${item.id}`,
    updated_at: item.updated_at,
  }));
}

export async function saveEmailDraft(input: {
  account_id?: number;
  message_id?: number;
  to?: string;
  subject: string;
  body: string;
}): Promise<{ message_entity_id: number }> {
  const data = await habitat().call("email.draft.save", withSubject(omitUndefined(input)));
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
    withSubject(omitUndefined({ account_id: accountId, limit })),
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
  const data = await habitat().call("email.message.search", withSubject(omitUndefined(input)));
  return data.messages.map(toUiMessage);
}

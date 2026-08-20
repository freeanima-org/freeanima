import {
  EMAIL_MESSAGE_COMPONENT,
  asEmailMessage,
  type EntityRow,
} from "@freeanima/habitat/core/db/schema/entity";

import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { worldIdForAccount } from "./email-world.ts";
import { normalizeRfcMessageId } from "./message-id.ts";
import { refreshThreadAggregates } from "./thread-store.ts";
import { softDeleteEmailAttachmentObjectFiles } from "./attachment-store.ts";
import type { EmailMessageListOpts, EmailMessageRow, EmailMessageUpsertInput } from "./types.ts";

export { normalizeRfcMessageId } from "./message-id.ts";

function normalizeTagIds(tagIds: number[] | undefined): number[] {
  if (!tagIds?.length) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of tagIds) {
    const id = Math.floor(raw);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function toMessageRow(
  row: NonNullable<ReturnType<typeof asEmailMessage>>,
  entity: Pick<EntityRow, "created_at" | "updated_at" | "tag_ids">,
): EmailMessageRow {
  return {
    id: row.id,
    subject: row.subject,
    preview: row.preview,
    body: row.body,
    content_type: row.content_type ?? "text/plain",
    text: row.text ?? (row.content_type === "text/html" ? "" : row.body),
    account_id: row.account_id,
    thread_id: row.thread_id,
    imap_uid: row.imap_uid ?? null,
    imap_mailbox: row.imap_mailbox ?? "INBOX",
    message_id: row.message_id ?? null,
    direction: row.direction,
    from: row.from,
    to: row.to,
    cc: row.cc ?? null,
    from_contact_id: row.from_contact_id ?? null,
    to_contact_ids: row.to_contact_ids ?? [],
    sent_at: row.sent_at,
    unread: row.unread ?? false,
    flags: row.flags ?? [],
    tag_ids: [...(entity.tag_ids ?? [])],
    headers: row.headers ?? null,
    attachments: row.attachments ?? [],
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
  };
}

export async function findEmailMessageByImapUid(
  accountId: number,
  imapUid: number,
  mailbox = "INBOX",
): Promise<EmailMessageRow | null> {
  const worldId = await worldIdForAccount(accountId);
  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_MESSAGE_COMPONENT,
    filters: { account_id: accountId, imap_uid: imapUid, imap_mailbox: mailbox },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  return toMessageRow(parsed, row);
}

/** Same account + mailbox + RFC Message-ID（跨 UID 去重；不跨邮箱）. */
export async function findEmailMessageByRfcMessageId(
  accountId: number,
  messageId: string,
  mailbox: string,
): Promise<EmailMessageRow | null> {
  const normalized = normalizeRfcMessageId(messageId);
  if (!normalized) return null;
  const worldId = await worldIdForAccount(accountId);
  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_MESSAGE_COMPONENT,
    filters: {
      account_id: accountId,
      imap_mailbox: mailbox,
      message_id: normalized,
    },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  return toMessageRow(parsed, row);
}

export async function upsertEmailMessage(input: EmailMessageUpsertInput): Promise<EmailMessageRow> {
  const mailbox = input.imap_mailbox ?? "INBOX";
  const rfcMessageId =
    input.message_id != null && input.message_id.trim()
      ? normalizeRfcMessageId(input.message_id)
      : null;
  let existing =
    input.imap_uid != null
      ? await findEmailMessageByImapUid(input.account_id, input.imap_uid, mailbox)
      : null;
  if (!existing && rfcMessageId) {
    existing = await findEmailMessageByRfcMessageId(input.account_id, rfcMessageId, mailbox);
  }

  const body = {
    account_id: input.account_id,
    thread_id: input.thread_id,
    imap_uid: input.imap_uid ?? undefined,
    imap_mailbox: mailbox,
    message_id: rfcMessageId ?? undefined,
    direction: input.direction,
    from: input.from,
    to: input.to,
    cc: input.cc ?? undefined,
    sent_at: input.sent_at,
    unread: input.unread ?? false,
    flags: input.flags ?? [],
    content_type: input.content_type ?? "text/plain",
    ...(input.text != null ? { text: input.text } : {}),
    ...(input.headers != null ? { headers: input.headers } : {}),
    ...(input.attachments != null ? { attachments: input.attachments } : {}),
    // 同步更新时保留已有联系人关联
    ...(existing?.from_contact_id != null ? { from_contact_id: existing.from_contact_id } : {}),
    ...(existing?.to_contact_ids != null && existing.to_contact_ids.length > 0
      ? { to_contact_ids: existing.to_contact_ids }
      : {}),
  };

  const tagIds = input.tag_ids !== undefined ? normalizeTagIds(input.tag_ids) : undefined;

  if (existing) {
    const row = await updateEntity({
      id: existing.id,
      title: input.subject,
      summary: input.preview,
      content: input.body,
      body,
      ...(tagIds !== undefined ? { tag_ids: tagIds } : {}),
    });
    if (!row) throw new Error("failed to update email message");
    const parsed = asEmailMessage(row);
    if (!parsed) throw new Error("failed to parse updated email message");
    await refreshThreadAggregates(input.thread_id);
    return toMessageRow(parsed, row);
  }

  const worldId = await worldIdForAccount(input.account_id);
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [EMAIL_MESSAGE_COMPONENT],
    primary_component: EMAIL_MESSAGE_COMPONENT,
    title: input.subject,
    summary: input.preview,
    content: input.body,
    body,
    ...(tagIds !== undefined ? { tag_ids: tagIds } : {}),
  });
  const parsed = asEmailMessage(row);
  if (!parsed) throw new Error("failed to create email message");
  await refreshThreadAggregates(input.thread_id);
  return toMessageRow(parsed, row);
}

export async function getEmailMessageRow(id: number): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  return toMessageRow(parsed, row);
}

export async function listEmailMessages(
  worldId: number,
  opts: EmailMessageListOpts = {},
): Promise<EmailMessageRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.account_id != null) filters.account_id = opts.account_id;
  if (opts.thread_id != null) filters.thread_id = opts.thread_id;
  if (opts.imap_mailbox != null) filters.imap_mailbox = opts.imap_mailbox;
  if (opts.unread != null) filters.unread = opts.unread;
  if (opts.flagged != null) filters.flagged = opts.flagged;
  if (opts.direction != null) filters.direction = opts.direction;
  const tagIdsFilter = opts.tag_ids?.length ? opts.tag_ids : undefined;
  if (opts.since) filters.since = opts.since;
  if (opts.before) filters.before = opts.before;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_MESSAGE_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(tagIdsFilter ? { tag_ids: tagIdsFilter } : {}),
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
    projection: "list",
  });

  return result.results
    .map((row) => {
      const parsed = asEmailMessage(row);
      return parsed ? toMessageRow(parsed, row) : null;
    })
    .filter((row): row is EmailMessageRow => row != null)
    .toSorted((a, b) => b.sent_at.localeCompare(a.sent_at) || b.id - a.id);
}

export async function markEmailMessageRead(
  id: number,
  unread = false,
): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  const updated = await updateEntity({ id, body: { ...parsed, unread } });
  if (!updated) return null;
  const next = asEmailMessage(updated);
  if (!next) return null;
  await refreshThreadAggregates(next.thread_id);
  return toMessageRow(next, updated);
}

export async function deleteEmailMessageRow(id: number): Promise<boolean> {
  const existing = await getEmailMessageRow(id);
  if (existing) {
    await softDeleteEmailAttachmentObjectFiles(existing.attachments);
  }
  const ok = await deleteEntity(id);
  if (ok && existing) await refreshThreadAggregates(existing.thread_id);
  return ok;
}

export async function tagEmailMessage(
  id: number,
  tagIds: number[],
): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  const updated = await updateEntity({ id, tag_ids: normalizeTagIds(tagIds) });
  if (!updated) return null;
  const next = asEmailMessage(updated);
  if (!next) return null;
  return toMessageRow(next, updated);
}

export async function setEmailMessageAttachments(
  id: number,
  attachments: import("@freeanima/habitat/core/db/schema/entity").EmailMessageAttachmentMeta[],
): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  const updated = await updateEntity({ id, body: { ...parsed, attachments } });
  if (!updated) return null;
  const next = asEmailMessage(updated);
  if (!next) return null;
  return toMessageRow(next, updated);
}

export async function listEmailMessageImapRefs(
  accountId: number,
  mailbox: string,
): Promise<Array<{ id: number; imap_uid: number; thread_id: number }>> {
  const worldId = await worldIdForAccount(accountId);
  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_MESSAGE_COMPONENT,
    filters: { account_id: accountId, imap_mailbox: mailbox },
    limit: 5000,
    mode: "filter_only",
    include_count: false,
    projection: "list",
  });

  const refs: Array<{ id: number; imap_uid: number; thread_id: number }> = [];
  for (const row of result.results) {
    const parsed = asEmailMessage(row);
    if (!parsed?.imap_uid) continue;
    refs.push({ id: parsed.id, imap_uid: parsed.imap_uid, thread_id: parsed.thread_id });
  }
  return refs;
}

export async function updateEmailMessageFlags(
  id: number,
  input: { unread: boolean; flags: string[] },
): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  const prevFlags = [...(parsed.flags ?? [])].toSorted();
  const nextFlags = [...input.flags].toSorted();
  const flagsUnchanged =
    prevFlags.length === nextFlags.length && prevFlags.every((flag, i) => flag === nextFlags[i]);
  if ((parsed.unread ?? false) === input.unread && flagsUnchanged) {
    return toMessageRow(parsed, row);
  }
  const updated = await updateEntity({
    id,
    body: { ...parsed, unread: input.unread, flags: input.flags },
  });
  if (!updated) return null;
  const next = asEmailMessage(updated);
  if (!next) return null;
  await refreshThreadAggregates(next.thread_id);
  return toMessageRow(next, updated);
}

export async function updateEmailMessageMailbox(
  id: number,
  input: { imap_mailbox: string; imap_uid?: number | null },
): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  const body = {
    ...parsed,
    imap_mailbox: input.imap_mailbox,
    ...(input.imap_uid !== undefined ? { imap_uid: input.imap_uid ?? undefined } : {}),
  };
  const updated = await updateEntity({ id, body });
  if (!updated) return null;
  const next = asEmailMessage(updated);
  if (!next) return null;
  return toMessageRow(next, updated);
}

export async function searchEmailMessages(
  worldId: number,
  input: {
    query?: string;
    account_id?: number;
    thread_id?: number;
    mailbox?: string;
    unread?: boolean;
    from?: string;
    to?: string;
    subject?: string;
    flagged?: boolean;
    has_attachment?: boolean;
    since?: string;
    before?: string;
    limit?: number;
  },
): Promise<EmailMessageRow[]> {
  const filters: Record<string, unknown> = {};
  if (input.account_id != null) filters.account_id = input.account_id;
  if (input.thread_id != null) filters.thread_id = input.thread_id;
  if (input.mailbox) filters.imap_mailbox = input.mailbox;
  if (input.unread != null) filters.unread = input.unread;
  if (input.from) filters.from = input.from;
  if (input.to) filters.to = input.to;
  if (input.subject) filters.subject = input.subject;
  if (input.flagged != null) filters.flagged = input.flagged;
  if (input.has_attachment != null) filters.has_attachment = input.has_attachment;
  if (input.since) filters.since = input.since;
  if (input.before) filters.before = input.before;

  const query = input.query?.trim() ?? "";
  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_MESSAGE_COMPONENT,
    ...(query ? { query } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: input.limit ?? 30,
    mode: query ? "hybrid" : "filter_only",
  });

  return result.results
    .map((row) => {
      const parsed = asEmailMessage(row);
      return parsed ? toMessageRow(parsed, row) : null;
    })
    .filter((row): row is EmailMessageRow => row != null);
}

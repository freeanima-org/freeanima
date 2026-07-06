import { EMAIL_MESSAGE_COMPONENT, asEmailMessage } from "@freeanima/core/db/schema/entity";

import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";
import { worldIdForAccount } from "./email-world.ts";
import { refreshThreadAggregates } from "./thread-store.ts";
import type { EmailMessageListOpts, EmailMessageRow, EmailMessageUpsertInput } from "./types.ts";

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function toMessageRow(
  row: NonNullable<ReturnType<typeof asEmailMessage>>,
  meta: { created_at: Date; updated_at: Date },
): EmailMessageRow {
  return {
    id: row.id,
    subject: row.subject,
    preview: row.preview,
    body: row.body,
    account_id: row.account_id,
    thread_id: row.thread_id,
    imap_uid: row.imap_uid ?? null,
    imap_mailbox: row.imap_mailbox ?? "INBOX",
    message_id: row.message_id ?? null,
    direction: row.direction,
    from: row.from,
    to: row.to,
    cc: row.cc ?? null,
    sent_at: row.sent_at,
    unread: row.unread ?? false,
    flags: row.flags ?? [],
    tags: row.tags ?? [],
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
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
    filters: { account_id: accountId },
    limit: 500,
    mode: "filter_only",
  });
  for (const row of result.results) {
    const parsed = asEmailMessage(row);
    if (parsed && parsed.imap_uid === imapUid && (parsed.imap_mailbox ?? "INBOX") === mailbox) {
      return toMessageRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
    }
  }
  return null;
}

export async function upsertEmailMessage(input: EmailMessageUpsertInput): Promise<EmailMessageRow> {
  const mailbox = input.imap_mailbox ?? "INBOX";
  const existing =
    input.imap_uid != null
      ? await findEmailMessageByImapUid(input.account_id, input.imap_uid, mailbox)
      : null;

  const body = {
    account_id: input.account_id,
    thread_id: input.thread_id,
    imap_uid: input.imap_uid ?? undefined,
    imap_mailbox: mailbox,
    message_id: input.message_id ?? undefined,
    direction: input.direction,
    from: input.from,
    to: input.to,
    cc: input.cc ?? undefined,
    sent_at: input.sent_at,
    unread: input.unread ?? false,
    flags: input.flags ?? [],
    tags: normalizeTags(input.tags),
  };

  if (existing) {
    const row = await updateEntity({
      id: existing.id,
      title: input.subject,
      summary: input.preview,
      content: input.body,
      body,
    });
    if (!row) throw new Error("failed to update email message");
    const parsed = asEmailMessage(row);
    if (!parsed) throw new Error("failed to parse updated email message");
    await refreshThreadAggregates(input.thread_id);
    return toMessageRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
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
  });
  const parsed = asEmailMessage(row);
  if (!parsed) throw new Error("failed to create email message");
  await refreshThreadAggregates(input.thread_id);
  return toMessageRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function getEmailMessageRow(id: number): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  return toMessageRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function listEmailMessages(
  worldId: number,
  opts: EmailMessageListOpts = {},
): Promise<EmailMessageRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.account_id != null) filters.account_id = opts.account_id;
  if (opts.thread_id != null) filters.thread_id = opts.thread_id;
  if (opts.unread != null) filters.unread = opts.unread;
  if (opts.direction != null) filters.direction = opts.direction;
  if (opts.tags?.length) filters.tags = opts.tags;
  if (opts.since) filters.since = opts.since;
  if (opts.before) filters.before = opts.before;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_MESSAGE_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  return result.results
    .map((row) => {
      const parsed = asEmailMessage(row);
      return parsed
        ? toMessageRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
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
  return toMessageRow(next, { created_at: updated.created_at, updated_at: updated.updated_at });
}

export async function deleteEmailMessageRow(id: number): Promise<boolean> {
  const existing = await getEmailMessageRow(id);
  const ok = await deleteEntity(id);
  if (ok && existing) await refreshThreadAggregates(existing.thread_id);
  return ok;
}

export async function tagEmailMessage(id: number, tags: string[]): Promise<EmailMessageRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailMessage(row);
  if (!parsed) return null;
  const updated = await updateEntity({ id, body: { ...parsed, tags: normalizeTags(tags) } });
  if (!updated) return null;
  const next = asEmailMessage(updated);
  if (!next) return null;
  return toMessageRow(next, { created_at: updated.created_at, updated_at: updated.updated_at });
}

export async function searchEmailMessages(
  worldId: number,
  input: {
    query: string;
    account_id?: number;
    thread_id?: number;
    unread?: boolean;
    limit?: number;
  },
): Promise<EmailMessageRow[]> {
  const filters: Record<string, unknown> = {};
  if (input.account_id != null) filters.account_id = input.account_id;
  if (input.thread_id != null) filters.thread_id = input.thread_id;
  if (input.unread != null) filters.unread = input.unread;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_MESSAGE_COMPONENT,
    query: input.query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: input.limit ?? 30,
    mode: "hybrid",
  });

  return result.results
    .map((row) => {
      const parsed = asEmailMessage(row);
      return parsed
        ? toMessageRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is EmailMessageRow => row != null);
}

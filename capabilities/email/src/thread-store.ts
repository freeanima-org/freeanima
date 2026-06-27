import { EMAIL_THREAD_COMPONENT, asEmailThread } from "@freeanima/core/db/schema/entity";

import {
  defaultEmailWorldId,
  getEntitySearchForEmail,
  getEntityStoreForEmail,
} from "./entity-port.ts";
import type { EmailThreadListOpts, EmailThreadRow, EmailThreadUpsertInput } from "./types.ts";

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

function toThreadRow(
  row: NonNullable<ReturnType<typeof asEmailThread>>,
  meta: { created_at: string; updated_at: string },
): EmailThreadRow {
  return {
    id: row.id,
    subject: row.subject,
    preview: row.preview,
    account_id: row.account_id,
    thread_key: row.thread_key,
    tags: row.tags ?? [],
    unread_count: row.unread_count ?? 0,
    message_count: row.message_count ?? 0,
    last_message_at: row.last_message_at ?? null,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
  };
}

export function normalizeEmailSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function deriveThreadKey(input: {
  message_id?: string | null;
  in_reply_to?: string | null;
  references?: string[] | null;
  subject: string;
}): string {
  const refs = input.references?.filter(Boolean) ?? [];
  if (refs.length > 0) return refs[0]!.trim();
  if (input.in_reply_to?.trim()) return input.in_reply_to.trim();
  if (input.message_id?.trim()) return input.message_id.trim();
  const normalized = normalizeEmailSubject(input.subject || "(no subject)");
  return `subject:${normalized || "empty"}`;
}

export async function findEmailThreadByKey(
  accountId: number,
  threadKey: string,
): Promise<EmailThreadRow | null> {
  const search = getEntitySearchForEmail();
  const result = await search.search({
    world_id: defaultEmailWorldId(),
    primary_component: EMAIL_THREAD_COMPONENT,
    filters: { account_id: accountId },
    limit: 500,
    mode: "filter_only",
  });
  for (const row of result.results) {
    const parsed = asEmailThread(row);
    if (parsed && parsed.thread_key === threadKey) {
      return toThreadRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
    }
  }
  return null;
}

export async function upsertEmailThread(input: EmailThreadUpsertInput): Promise<EmailThreadRow> {
  const store = getEntityStoreForEmail();
  const existing = await findEmailThreadByKey(input.account_id, input.thread_key);
  if (existing) {
    const unreadDelta = input.unread_delta ?? 0;
    const messageDelta = input.message_delta ?? 0;
    const row = await store.update({
      id: existing.id,
      title: input.subject,
      summary: input.preview,
      body: {
        account_id: input.account_id,
        thread_key: input.thread_key,
        tags: input.tags != null ? normalizeTags(input.tags) : existing.tags,
        unread_count: Math.max(0, existing.unread_count + unreadDelta),
        message_count: Math.max(0, existing.message_count + messageDelta),
        last_message_at: input.last_message_at,
      },
    });
    if (!row) throw new Error("failed to update email thread");
    const parsed = asEmailThread(row);
    if (!parsed) throw new Error("failed to parse updated email thread");
    return toThreadRow(parsed, {
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  const row = await store.create({
    type: "content",
    world_id: defaultEmailWorldId(),
    components: [EMAIL_THREAD_COMPONENT],
    primary_component: EMAIL_THREAD_COMPONENT,
    title: input.subject,
    summary: input.preview,
    body: {
      account_id: input.account_id,
      thread_key: input.thread_key,
      tags: normalizeTags(input.tags),
      unread_count: Math.max(0, input.unread_delta ?? 0),
      message_count: Math.max(0, input.message_delta ?? 1),
      last_message_at: input.last_message_at,
    },
  });
  const parsed = asEmailThread(row);
  if (!parsed) throw new Error("failed to create email thread");
  return toThreadRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function listEmailThreads(opts: EmailThreadListOpts = {}): Promise<EmailThreadRow[]> {
  const search = getEntitySearchForEmail();
  const filters: Record<string, unknown> = {};
  if (opts.account_id != null) filters.account_id = opts.account_id;
  if (opts.has_unread) filters.has_unread = true;
  if (opts.tags?.length) filters.tags = opts.tags;

  const result = await search.search({
    world_id: defaultEmailWorldId(),
    primary_component: EMAIL_THREAD_COMPONENT,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  return result.results
    .map((row) => {
      const parsed = asEmailThread(row);
      return parsed
        ? toThreadRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is EmailThreadRow => row != null)
    .toSorted(
      (a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "") || b.id - a.id,
    );
}

export async function tagEmailThread(id: number, tags: string[]): Promise<EmailThreadRow | null> {
  const store = getEntityStoreForEmail();
  const row = await store.get(id);
  if (!row) return null;
  const parsed = asEmailThread(row);
  if (!parsed) return null;
  const updated = await store.update({ id, body: { ...parsed, tags: normalizeTags(tags) } });
  if (!updated) return null;
  const next = asEmailThread(updated);
  if (!next) return null;
  return toThreadRow(next, { created_at: updated.created_at, updated_at: updated.updated_at });
}

export async function refreshThreadAggregates(threadId: number): Promise<void> {
  const messages = await import("./message-store.ts").then((m) =>
    m.listEmailMessages({ thread_id: threadId, limit: 500 }),
  );
  const unread_count = messages.filter((m) => m.unread).length;
  const last = messages[0];
  const store = getEntityStoreForEmail();
  const row = await store.get(threadId);
  if (!row) return;
  const parsed = asEmailThread(row);
  if (!parsed) return;
  await store.update({
    id: threadId,
    summary: last?.preview ?? parsed.preview,
    body: {
      ...parsed,
      unread_count,
      message_count: messages.length,
      last_message_at: last?.sent_at ?? parsed.last_message_at,
    },
  });
}

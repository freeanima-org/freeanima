import {
  EMAIL_THREAD_COMPONENT,
  asEmailThread,
  type EntityRow,
} from "@freeanima/host/core/db/schema/entity";

import {
  createEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { worldIdForAccount, worldIdForThread } from "./email-world.ts";
import type { EmailThreadListOpts, EmailThreadRow, EmailThreadUpsertInput } from "./types.ts";

function normalizeTagIds(tagIds: number[] | undefined): number[] {
  if (!tagIds?.length) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of tagIds) {
    const id = Math.floor(Number(raw));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function toThreadRow(
  row: NonNullable<ReturnType<typeof asEmailThread>>,
  entity: Pick<EntityRow, "created_at" | "updated_at" | "tag_ids">,
): EmailThreadRow {
  return {
    id: row.id,
    subject: row.subject,
    preview: row.preview,
    account_id: row.account_id,
    thread_key: row.thread_key,
    tag_ids: [...(entity.tag_ids ?? [])],
    unread_count: row.unread_count ?? 0,
    message_count: row.message_count ?? 0,
    last_message_at: row.last_message_at ?? null,
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
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
  if (refs.length > 0) {
    const firstRef = refs[0];
    if (firstRef) return firstRef.trim();
  }
  if (input.in_reply_to?.trim()) return input.in_reply_to.trim();
  if (input.message_id?.trim()) return input.message_id.trim();
  const normalized = normalizeEmailSubject(input.subject || "(no subject)");
  return `subject:${normalized || "empty"}`;
}

export async function findEmailThreadByKey(
  accountId: number,
  threadKey: string,
): Promise<EmailThreadRow | null> {
  const worldId = await worldIdForAccount(accountId);
  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_THREAD_COMPONENT,
    filters: { account_id: accountId, thread_key: threadKey },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asEmailThread(row);
  if (!parsed) return null;
  return toThreadRow(parsed, row);
}

export async function upsertEmailThread(input: EmailThreadUpsertInput): Promise<EmailThreadRow> {
  const existing = await findEmailThreadByKey(input.account_id, input.thread_key);
  const tagIds = input.tag_ids !== undefined ? normalizeTagIds(input.tag_ids) : undefined;
  if (existing) {
    const unreadDelta = input.unread_delta ?? 0;
    const messageDelta = input.message_delta ?? 0;
    const row = await updateEntity({
      id: existing.id,
      title: input.subject,
      summary: input.preview,
      body: {
        account_id: input.account_id,
        thread_key: input.thread_key,
        unread_count: Math.max(0, existing.unread_count + unreadDelta),
        message_count: Math.max(0, existing.message_count + messageDelta),
        last_message_at: input.last_message_at,
      },
      ...(tagIds !== undefined ? { tag_ids: tagIds } : {}),
    });
    if (!row) throw new Error("failed to update email thread");
    const parsed = asEmailThread(row);
    if (!parsed) throw new Error("failed to parse updated email thread");
    return toThreadRow(parsed, row);
  }

  const worldId = await worldIdForAccount(input.account_id);
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [EMAIL_THREAD_COMPONENT],
    primary_component: EMAIL_THREAD_COMPONENT,
    title: input.subject,
    summary: input.preview,
    body: {
      account_id: input.account_id,
      thread_key: input.thread_key,
      unread_count: Math.max(0, input.unread_delta ?? 0),
      message_count: Math.max(0, input.message_delta ?? 1),
      last_message_at: input.last_message_at,
    },
    ...(tagIds !== undefined ? { tag_ids: tagIds } : {}),
  });
  const parsed = asEmailThread(row);
  if (!parsed) throw new Error("failed to create email thread");
  return toThreadRow(parsed, row);
}

export async function listEmailThreads(
  worldId: number,
  opts: EmailThreadListOpts = {},
): Promise<EmailThreadRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.account_id != null) filters.account_id = opts.account_id;
  if (opts.has_unread) filters.has_unread = true;
  const tagIdsFilter = opts.tag_ids?.length ? opts.tag_ids : undefined;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: EMAIL_THREAD_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(tagIdsFilter ? { tag_ids: tagIdsFilter } : {}),
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  return result.results
    .map((row) => {
      const parsed = asEmailThread(row);
      return parsed ? toThreadRow(parsed, row) : null;
    })
    .filter((row): row is EmailThreadRow => row != null)
    .toSorted(
      (a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "") || b.id - a.id,
    );
}

export async function tagEmailThread(id: number, tagIds: number[]): Promise<EmailThreadRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asEmailThread(row);
  if (!parsed) return null;
  const updated = await updateEntity({ id, tag_ids: normalizeTagIds(tagIds) });
  if (!updated) return null;
  const next = asEmailThread(updated);
  if (!next) return null;
  return toThreadRow(next, updated);
}

export async function refreshThreadAggregates(threadId: number): Promise<void> {
  const worldId = await worldIdForThread(threadId);
  const messages = await import("./message-store.ts").then((m) =>
    m.listEmailMessages(worldId, { thread_id: threadId, limit: 500 }),
  );
  const unread_count = messages.filter((m) => m.unread).length;
  const last = messages[0];
  const row = await getEntity(threadId);
  if (!row) return;
  const parsed = asEmailThread(row);
  if (!parsed) return;
  await updateEntity({
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

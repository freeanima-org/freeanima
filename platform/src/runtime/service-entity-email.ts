import { isPostgresPrimary } from "@freeanima/core/db/pg";
import { omitUndefined } from "@freeanima/core/util";
import { resolveSubjectWorldId, type SubjectKind } from "@freeanima/core/config";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function emailWorldId(kind: SubjectKind = "agent"): number {
  return resolveSubjectWorldId(kind);
}

function toAccountPayload(
  account: Awaited<
    ReturnType<typeof import("@freeanima/capabilities-email").listEmailAccountRows>
  >[number],
) {
  return {
    id: account.id,
    display_name: account.display_name,
    address: account.address,
    smtp_host: account.smtp_host,
    smtp_port: account.smtp_port,
    imap_host: account.imap_host,
    imap_port: account.imap_port,
    default_sender: account.default_sender,
    enabled: account.enabled,
    desc: account.desc,
    tags: account.tags,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

function toMessagePayload(
  message: NonNullable<
    Awaited<ReturnType<typeof import("@freeanima/capabilities-email").getEmailMessageRow>>
  >,
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
    created_at: message.created_at,
    updated_at: message.updated_at,
  };
}

function toThreadPayload(
  thread: Awaited<
    ReturnType<typeof import("@freeanima/capabilities-email").listEmailThreads>
  >[number],
) {
  return {
    id: thread.id,
    subject: thread.subject,
    preview: thread.preview,
    account_id: thread.account_id,
    thread_key: thread.thread_key,
    tags: thread.tags,
    unread_count: thread.unread_count,
    message_count: thread.message_count,
    last_message_at: thread.last_message_at,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
  };
}

export async function serviceEmailAccountList(
  deps: RuntimeDeps,
  input?: { subject_kind?: SubjectKind },
) {
  assertPg(deps);
  const { listEmailAccountRows } = await import("@freeanima/capabilities-email");
  const accounts = await listEmailAccountRows(emailWorldId(input?.subject_kind));
  return { accounts: accounts.map(toAccountPayload) };
}

export async function serviceEmailMessageList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    account_id?: number;
    thread_id?: number;
    unread?: boolean;
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const { listEmailMessages } = await import("@freeanima/capabilities-email");
  const { subject_kind, ...listInput } = input;
  const messages = await listEmailMessages(emailWorldId(subject_kind), listInput);
  return { messages: messages.map(toMessagePayload) };
}

export async function serviceEmailMessageRead(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const { getEmailMessageRow } = await import("@freeanima/capabilities-email");
  const message = await getEmailMessageRow(input.id);
  if (!message) throw new Error("NOT_FOUND");
  return { message: toMessagePayload(message) };
}

export async function serviceEmailMessageMarkRead(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const { markAsRead } = await import("@freeanima/platform/connectors/email");
  await markAsRead(input.id);
  return { ok: true as const };
}

export async function serviceEmailSync(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; account_id?: number; limit?: number },
) {
  assertPg(deps);
  const { syncEmailAccount, syncAllEmailAccounts } =
    await import("@freeanima/platform/connectors/email");
  if (input.account_id != null) {
    return {
      results: [await syncEmailAccount(input.account_id, omitUndefined({ limit: input.limit }))],
    };
  }
  return { results: await syncAllEmailAccounts(omitUndefined({ limit: input.limit })) };
}

export async function serviceEmailThreadList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; account_id?: number; has_unread?: boolean; limit?: number },
) {
  assertPg(deps);
  const { listEmailThreads } = await import("@freeanima/capabilities-email");
  const { subject_kind, ...listInput } = input;
  const threads = await listEmailThreads(emailWorldId(subject_kind), listInput);
  return { threads: threads.map(toThreadPayload) };
}

export async function serviceEmailMessageSearch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    query: string;
    account_id?: number;
    limit?: number;
  },
) {
  assertPg(deps);
  const { searchEmailMessages } = await import("@freeanima/capabilities-email");
  const { subject_kind, ...searchInput } = input;
  const messages = await searchEmailMessages(emailWorldId(subject_kind), searchInput);
  return { messages: messages.map(toMessagePayload) };
}

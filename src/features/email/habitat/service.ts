import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import { omitUndefined } from "@freeanima/host/core/util";
import { resolveSubjectWorldId, type SubjectKind } from "@freeanima/host/core/config";
import {
  applyProviderPreset,
  createEmailAccount,
  deleteEmailAccountRow,
  getEmailMessageRow,
  listEmailAccountRows,
  listEmailMessages,
  listEmailProviderPresets,
  listEmailThreads,
  requireCompleteEmailHosts,
  searchEmailMessages,
  updateEmailAccount,
} from "../domain/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function emailWorldId(kind: SubjectKind = "agent"): number {
  return resolveSubjectWorldId(kind);
}

function toAccountPayload(account: Awaited<ReturnType<typeof listEmailAccountRows>>[number]) {
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

async function toMessagePayload(
  message: NonNullable<Awaited<ReturnType<typeof getEmailMessageRow>>>,
  opts: { raw?: boolean; includeHeaders?: boolean; includeAttachments?: boolean } = {},
) {
  const { messagePayload } = await import("../domain/email-tool-helpers.ts");
  const payload = await messagePayload(message, opts);
  return {
    ...payload,
    created_at: message.created_at,
    updated_at: message.updated_at,
  };
}

function toThreadPayload(thread: Awaited<ReturnType<typeof listEmailThreads>>[number]) {
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
  const accounts = await listEmailAccountRows(emailWorldId(input?.subject_kind));
  return { accounts: accounts.map(toAccountPayload) };
}

export async function serviceEmailProviderList(_deps: RuntimeDeps) {
  return { providers: listEmailProviderPresets() };
}

export async function serviceEmailAccountCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    password: string;
    address: string;
    display_name?: string;
    provider?: string;
    smtp_host?: string;
    smtp_port?: number;
    imap_host?: string;
    imap_port?: number;
    default_sender?: boolean;
    enabled?: boolean;
    desc?: string;
    tags?: string[];
  },
) {
  assertPg(deps);
  const { subject_kind, ...raw } = input;
  const withPreset = applyProviderPreset(raw);
  const hosts = requireCompleteEmailHosts(withPreset);
  const { assertEmailPasswordResolvable } =
    await import("@freeanima/host/capabilities/connectors/email");
  await assertEmailPasswordResolvable({ password: withPreset.password });
  const account = await createEmailAccount(
    emailWorldId(subject_kind),
    omitUndefined({
      password: withPreset.password,
      address: withPreset.address,
      smtp_host: hosts.smtp_host,
      smtp_port: hosts.smtp_port,
      imap_host: hosts.imap_host,
      imap_port: hosts.imap_port,
      display_name: withPreset.display_name,
      default_sender: withPreset.default_sender,
      enabled: withPreset.enabled,
      desc: withPreset.desc,
      tags: withPreset.tags,
    }),
  );
  return { account: toAccountPayload(account) };
}

export async function serviceEmailAccountPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    password?: string;
    address?: string;
    display_name?: string;
    provider?: string;
    smtp_host?: string;
    smtp_port?: number;
    imap_host?: string;
    imap_port?: number;
    default_sender?: boolean;
    enabled?: boolean;
    desc?: string;
    tags?: string[];
  },
) {
  assertPg(deps);
  const { subject_kind, id, ...raw } = input;
  const withPreset = applyProviderPreset(raw);
  const touchesHosts =
    withPreset.provider != null ||
    withPreset.smtp_host != null ||
    withPreset.smtp_port != null ||
    withPreset.imap_host != null ||
    withPreset.imap_port != null;
  const hosts = touchesHosts ? requireCompleteEmailHosts(withPreset) : null;
  if (withPreset.password) {
    const { assertEmailPasswordResolvable } =
      await import("@freeanima/host/capabilities/connectors/email");
    await assertEmailPasswordResolvable({ password: withPreset.password });
  }
  const account = await updateEmailAccount(
    emailWorldId(subject_kind),
    omitUndefined({
      id,
      password: withPreset.password,
      address: withPreset.address,
      smtp_host: hosts?.smtp_host,
      smtp_port: hosts?.smtp_port,
      imap_host: hosts?.imap_host,
      imap_port: hosts?.imap_port,
      display_name: withPreset.display_name,
      default_sender: withPreset.default_sender,
      enabled: withPreset.enabled,
      desc: withPreset.desc,
      tags: withPreset.tags,
    }),
  );
  if (!account) throw new Error("NOT_FOUND");
  return { account: toAccountPayload(account) };
}

export async function serviceEmailAccountDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const ok = await deleteEmailAccountRow(emailWorldId(input.subject_kind), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceEmailMessageList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    account_id?: number;
    thread_id?: number;
    unread?: boolean;
    direction?: "inbound" | "outbound";
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const { subject_kind, ...listInput } = input;
  const messages = await listEmailMessages(emailWorldId(subject_kind), listInput);
  return { messages: await Promise.all(messages.map((m) => toMessagePayload(m))) };
}

export async function serviceEmailMessageRead(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; raw?: boolean | undefined },
) {
  assertPg(deps);
  const message = await getEmailMessageRow(input.id);
  if (!message) throw new Error("NOT_FOUND");
  return {
    message: await toMessagePayload(message, {
      raw: input.raw === true,
      includeHeaders: true,
      includeAttachments: true,
    }),
  };
}

export async function serviceEmailMessageMarkRead(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const { markAsRead } = await import("@freeanima/host/capabilities/connectors/email");
  await markAsRead(input.id);
  return { ok: true as const };
}

export async function serviceEmailMessageMarkUnread(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const { markAsUnread } = await import("@freeanima/host/capabilities/connectors/email");
  await markAsUnread(input.id);
  return { ok: true as const };
}

export async function serviceEmailMessageDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const { deleteEmail } = await import("@freeanima/host/capabilities/connectors/email");
  await deleteEmail(input.id);
  return { ok: true as const };
}

export async function serviceEmailSend(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    account_id?: number;
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
  },
) {
  assertPg(deps);
  const { sendEmail } = await import("@freeanima/host/capabilities/connectors/email");
  const { subject_kind: _subjectKind, ...sendInput } = input;
  return sendEmail(omitUndefined(sendInput));
}

export async function serviceEmailSync(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; account_id?: number; limit?: number },
) {
  assertPg(deps);
  const { syncEmailAccount, syncAllEmailAccounts } =
    await import("@freeanima/host/capabilities/connectors/email");
  if (input.account_id != null) {
    return {
      results: [await syncEmailAccount(input.account_id, omitUndefined({ limit: input.limit }))],
    };
  }
  return {
    results: await syncAllEmailAccounts({
      worldId: emailWorldId(input.subject_kind),
      ...(input.limit != null ? { limit: input.limit } : {}),
    }),
  };
}

export async function serviceEmailThreadList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; account_id?: number; has_unread?: boolean; limit?: number },
) {
  assertPg(deps);
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
    from?: string;
    sent_after?: string;
    sent_before?: string;
    limit?: number;
  },
) {
  assertPg(deps);
  const { subject_kind, sent_after, sent_before, ...rest } = input;
  const messages = await searchEmailMessages(
    emailWorldId(subject_kind),
    omitUndefined({
      ...rest,
      since: sent_after,
      before: sent_before,
    }),
  );
  return { messages: await Promise.all(messages.map((m) => toMessagePayload(m))) };
}

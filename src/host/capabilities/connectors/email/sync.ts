import { omitUndefined } from "@freeanima/host/core/util";
import {
  deriveThreadKey,
  findEmailMessageByImapUid,
  getEmailAccountRow,
  listAllEnabledEmailAccountRows,
  listEmailMessageImapRefs,
  listEnabledEmailAccountRows,
  normalizeEmailSubject,
  updateEmailAccount,
  updateEmailMessageFlags,
  upsertEmailMessage,
  upsertEmailThread,
  worldIdForAccount,
  type EmailSyncResult,
} from "@freeanima/features/email/domain";
import {
  collectFlagRefreshUids,
  defaultSyncMailboxPaths,
  getMailboxCursor,
  inferSpecialUseFromPath,
  resolveSpecialMailboxes,
  setMailboxCursor,
  specialUseFromImapFlags,
} from "@freeanima/features/email/domain/sync-state";
import { parseEmailMime } from "@freeanima/features/email/domain/mime-parse";
import { persistEmailAttachments } from "@freeanima/features/email/domain/attachment-store";
import { setEmailMessageAttachments } from "@freeanima/features/email/domain";
import { formatCstIso } from "@freeanima/host/core/util";
import type { EmailAccountSync } from "@freeanima/host/core/db/schema/entity";
import type { ImapFlow } from "imapflow";

import {
  extractBody,
  formatAddress,
  messagePreview,
  parseImapHeaderBuffer,
  withImapAccount,
} from "./imap-client.ts";

export type ListedMailbox = {
  path: string;
  name?: string;
  /** IMAP SPECIAL-USE flag(s), e.g. \\Sent */
  special_use?: string[];
  subscribed?: boolean;
};

function normalizeSpecialUseField(raw: unknown): string[] | undefined {
  if (typeof raw === "string" && raw.trim()) return [raw];
  if (Array.isArray(raw)) {
    const flags = raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return flags.length > 0 ? flags : undefined;
  }
  return undefined;
}

async function listMailboxesFromClient(client: ImapFlow): Promise<ListedMailbox[]> {
  const mailboxes: ListedMailbox[] = [];
  const listed = await client.list();
  for (const entry of listed) {
    mailboxes.push(
      omitUndefined({
        path: entry.path,
        name: entry.name,
        special_use: normalizeSpecialUseField(entry.specialUse),
        subscribed: entry.subscribed,
      }),
    );
  }
  return mailboxes;
}

export async function listMailboxesForAccount(accountId: number): Promise<ListedMailbox[]> {
  const account = await getEmailAccountRow(accountId);
  if (!account?.enabled) {
    throw new Error("account not found or disabled");
  }
  return withImapAccount(account, async (client) => listMailboxesFromClient(client));
}

function toListedForResolve(listed: ListedMailbox[]) {
  return listed.map((box) =>
    omitUndefined({
      path: box.path,
      special_use: box.special_use?.length
        ? specialUseFromImapFlags(box.special_use)
        : inferSpecialUseFromPath(box.path),
    }),
  );
}

async function syncMailboxMessages(
  client: ImapFlow,
  account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>,
  mailbox: string,
  limit: number,
): Promise<{
  upsertedMessages: number;
  upsertedThreads: number;
  highestUid: number | null;
  newSubjects: string[];
}> {
  let upsertedMessages = 0;
  let upsertedThreads = 0;
  let highestUid: number | null = getMailboxCursor(account.sync, mailbox).last_uid ?? null;
  const newSubjects: string[] = [];
  const inboxMailbox = isInboxMailbox(account, mailbox);

  const lock = await client.getMailboxLock(mailbox);
  try {
    const status = await client.status(mailbox, { uidNext: true, uidValidity: true });
    const uidvalidity = status.uidValidity != null ? Number(status.uidValidity) : undefined;
    const cursor = getMailboxCursor(account.sync, mailbox);
    const previousValidity = cursor.uidvalidity;
    const resetSync =
      previousValidity != null && uidvalidity != null && previousValidity !== uidvalidity;
    const lastUid = resetSync ? 0 : (cursor.last_uid ?? 0);

    const searchQuery =
      lastUid > 0 ? ({ uid: `${lastUid + 1}:*` } as const) : ({ all: true } as const);
    const uids = (await client.search(searchQuery, { uid: true })) as number[];
    const uidList = uids.filter((uid) => uid > lastUid).slice(-limit);

    for (const uid of uidList) {
      const msg = await client.fetchOne(
        uid,
        { envelope: true, flags: true, source: true, headers: true },
        { uid: true },
      );
      if (!msg) continue;

      const envelope = msg.envelope;
      const parsedHeaders = parseImapHeaderBuffer(msg.headers);
      const messageId = parsedHeaders.messageId ?? envelope?.messageId ?? undefined;
      const inReplyTo = parsedHeaders.inReplyTo ?? envelope?.inReplyTo;
      const references = parsedHeaders.references;
      const subject = envelope?.subject ?? "(No subject)";
      const threadKey = deriveThreadKey(
        omitUndefined({
          message_id: messageId,
          in_reply_to: inReplyTo,
          references,
          subject,
        }),
      );
      const rawSource = extractBody(msg.source);
      const mime = await parseEmailMime(rawSource);
      const bodyText = mime.content;
      const preview = messagePreview(mime.text || bodyText);
      const sentAt = envelope?.date?.toISOString() ?? formatCstIso();
      const unread = !msg.flags?.has("\\Seen");

      const thread = await upsertEmailThread({
        account_id: account.id,
        thread_key: threadKey,
        subject: normalizeEmailSubject(subject) || subject,
        preview,
        last_message_at: sentAt,
        unread_delta: unread ? 1 : 0,
        message_delta: 1,
      });
      upsertedThreads += 1;

      const existingBefore = await findEmailMessageByImapUid(account.id, uid, mailbox);
      const message = await upsertEmailMessage({
        account_id: account.id,
        thread_id: thread.id,
        subject,
        preview,
        body: bodyText,
        content_type: mime.content_type,
        text: mime.text,
        headers: mime.headers,
        imap_uid: uid,
        imap_mailbox: mailbox,
        message_id: messageId ?? null,
        direction: "inbound",
        from: formatAddress(envelope?.from?.[0]),
        to: formatAddress(envelope?.to?.[0]),
        sent_at: sentAt,
        unread,
        flags: [...(msg.flags ?? [])],
      });
      if (mime.attachments.length > 0) {
        const attachmentMeta = await persistEmailAttachments(
          account.id,
          message.id,
          mime.attachments,
        );
        await setEmailMessageAttachments(message.id, attachmentMeta);
      }
      if (!existingBefore) {
        upsertedMessages += 1;
        if (inboxMailbox) newSubjects.push(subject.trim() || "(No subject)");
      }
      highestUid = Math.max(highestUid ?? 0, uid);
    }

    await refreshMailboxFlags(client, account.id, mailbox, highestUid ?? lastUid);
  } finally {
    lock.release();
  }

  return { upsertedMessages, upsertedThreads, highestUid, newSubjects };
}

function isInboxMailbox(
  account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>,
  mailbox: string,
): boolean {
  const cursor = getMailboxCursor(account.sync, mailbox);
  if (cursor.special_use === "inbox") return true;
  const upper = mailbox.toUpperCase();
  return upper === "INBOX" || upper.endsWith("/INBOX");
}

async function refreshMailboxFlags(
  client: ImapFlow,
  accountId: number,
  mailbox: string,
  lastUid: number | null,
): Promise<void> {
  const localRefs = await listEmailMessageImapRefs(accountId, mailbox);
  const uidSet = collectFlagRefreshUids(
    localRefs.map((ref) => ref.imap_uid),
    lastUid ?? undefined,
  );
  if (uidSet.length === 0) return;

  const uidQuery = uidSet.join(",");
  for await (const msg of client.fetch(uidQuery, { flags: true }, { uid: true })) {
    const uid = msg.uid;
    if (uid == null) continue;
    const ref = localRefs.find((r) => r.imap_uid === uid);
    if (!ref) continue;
    const flags = [...(msg.flags ?? [])];
    const unread = !msg.flags?.has("\\Seen");
    await updateEmailMessageFlags(ref.id, { unread, flags });
  }
}

export async function syncEmailAccount(
  accountId: number,
  opts: { limit?: number } = {},
): Promise<EmailSyncResult> {
  const limit = opts.limit ?? 500;
  let worldId = 0;
  try {
    worldId = await worldIdForAccount(accountId);
  } catch {
    return {
      account_id: accountId,
      world_id: 0,
      upserted_messages: 0,
      upserted_threads: 0,
      highest_uid: null,
      new_subjects: [],
      error: "account not found or disabled",
    };
  }
  const account = await getEmailAccountRow(accountId);
  if (!account || !account.enabled) {
    return {
      account_id: accountId,
      world_id: worldId,
      upserted_messages: 0,
      upserted_threads: 0,
      highest_uid: null,
      new_subjects: [],
      error: "account not found or disabled",
    };
  }

  let upsertedMessages = 0;
  let upsertedThreads = 0;
  let highestUid: number | null = null;
  const newSubjects: string[] = [];

  try {
    await withImapAccount(account, async (client) => {
      const listed = await listMailboxesFromClient(client);
      const resolved = resolveSpecialMailboxes(
        toListedForResolve(listed),
        omitUndefined({
          sent_mailbox: account.sent_mailbox,
          trash_mailbox: account.trash_mailbox,
          drafts_mailbox: account.drafts_mailbox,
        }),
      );
      const targets = defaultSyncMailboxPaths(resolved, account.sync);

      let workingSync: EmailAccountSync = account.sync ?? { mailboxes: {} };

      for (const mailbox of targets) {
        const result = await syncMailboxMessages(client, account, mailbox, limit);
        upsertedMessages += result.upsertedMessages;
        upsertedThreads += result.upsertedThreads;
        newSubjects.push(...result.newSubjects);
        if (result.highestUid != null) {
          highestUid =
            highestUid == null ? result.highestUid : Math.max(highestUid, result.highestUid);
        }

        const cursor = getMailboxCursor(workingSync, mailbox);
        const status = await client.status(mailbox, { uidValidity: true });
        const nextValidity =
          status.uidValidity != null ? Number(status.uidValidity) : cursor.uidvalidity;
        const next = setMailboxCursor(
          workingSync,
          mailbox,
          omitUndefined({
            ...cursor,
            uidvalidity: nextValidity,
            last_uid: result.highestUid ?? cursor.last_uid,
            last_sync_at: formatCstIso(),
          }),
        );
        workingSync = { mailboxes: next.mailboxes };
      }

      await updateEmailAccount(
        await worldIdForAccount(account.id),
        omitUndefined({
          id: account.id,
          sync: workingSync,
          mailbox_paths: resolved.paths,
          sent_mailbox: resolved.sent_mailbox,
          trash_mailbox: resolved.trash_mailbox,
          drafts_mailbox: resolved.drafts_mailbox,
        }),
      );
    });
  } catch (err) {
    return {
      account_id: accountId,
      world_id: worldId,
      upserted_messages: upsertedMessages,
      upserted_threads: upsertedThreads,
      highest_uid: highestUid,
      new_subjects: newSubjects,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    account_id: accountId,
    world_id: worldId,
    upserted_messages: upsertedMessages,
    upserted_threads: upsertedThreads,
    highest_uid: highestUid,
    new_subjects: newSubjects,
  };
}

export async function syncAllEmailAccounts(
  opts: {
    worldId?: number;
    limit?: number;
  } = {},
): Promise<EmailSyncResult[]> {
  const accounts =
    opts.worldId != null
      ? await listEnabledEmailAccountRows(opts.worldId).catch(() => [])
      : await listAllEnabledEmailAccountRows();
  const results: EmailSyncResult[] = [];
  for (const account of accounts) {
    results.push(await syncEmailAccount(account.id, omitUndefined({ limit: opts.limit })));
  }
  return results;
}

export const emailSyncPortImpl = {
  syncAccount: syncEmailAccount,
  syncAll: syncAllEmailAccounts,
};

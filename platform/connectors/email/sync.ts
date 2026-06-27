import {
  deriveThreadKey,
  findEmailMessageByImapUid,
  getEmailAccountRow,
  listEnabledEmailAccountRows,
  normalizeEmailSubject,
  updateEmailAccount,
  upsertEmailMessage,
  upsertEmailThread,
  type EmailSyncResult,
} from "@freeanima/capabilities-email";
import { formatCstIso } from "@freeanima/core/util";

import { extractBody, formatAddress, messagePreview, withImapAccount } from "./imap-client.ts";

function parseReferences(raw: unknown): string[] {
  if (typeof raw === "string") {
    return raw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return [];
}

export async function syncEmailAccount(
  accountId: number,
  opts: { limit?: number } = {},
): Promise<EmailSyncResult> {
  const limit = opts.limit ?? 500;
  const account = await getEmailAccountRow(accountId);
  if (!account || !account.enabled) {
    return {
      account_id: accountId,
      upserted_messages: 0,
      upserted_threads: 0,
      highest_uid: null,
      error: "account not found or disabled",
    };
  }

  const mailbox = account.sync?.mailbox ?? "INBOX";
  let upsertedMessages = 0;
  let upsertedThreads = 0;
  let highestUid: number | null = account.sync?.last_uid ?? null;

  try {
    await withImapAccount(
      account,
      async (client, box) => {
        const lock = await client.getMailboxLock(box);
        try {
          const status = await client.status(box, { uidNext: true, uidValidity: true });
          const uidvalidity = status.uidValidity != null ? Number(status.uidValidity) : undefined;
          const previousValidity = account.sync?.uidvalidity;
          const resetSync =
            previousValidity != null && uidvalidity != null && previousValidity !== uidvalidity;
          const lastUid = resetSync ? 0 : (account.sync?.last_uid ?? 0);

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
            const headers = msg.headers as Map<string, string[]> | undefined;
            const messageId = headers?.get("message-id")?.[0] ?? envelope?.messageId ?? undefined;
            const inReplyTo = headers?.get("in-reply-to")?.[0];
            const references = parseReferences(headers?.get("references")?.[0]);
            const subject = envelope?.subject ?? "(No subject)";
            const threadKey = deriveThreadKey({
              message_id: messageId,
              in_reply_to: inReplyTo,
              references,
              subject,
            });
            const bodyText = extractBody(msg.source);
            const preview = messagePreview(bodyText);
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

            const existingBefore = await findEmailMessageByImapUid(account.id, uid, box);
            await upsertEmailMessage({
              account_id: account.id,
              thread_id: thread.id,
              subject,
              preview,
              body: bodyText,
              imap_uid: uid,
              imap_mailbox: box,
              message_id: messageId ?? null,
              direction: "inbound",
              from: formatAddress(envelope?.from?.[0]),
              to: formatAddress(envelope?.to?.[0]),
              sent_at: sentAt,
              unread,
              flags: [...(msg.flags ?? [])],
            });
            if (!existingBefore) upsertedMessages += 1;
            highestUid = Math.max(highestUid ?? 0, uid);
          }
        } finally {
          lock.release();
        }

        const status = await client.status(box, { uidValidity: true });
        const nextValidity =
          status.uidValidity != null ? Number(status.uidValidity) : account.sync?.uidvalidity;
        await updateEmailAccount({
          id: account.id,
          sync: {
            mailbox: box,
            uidvalidity: nextValidity,
            last_uid: highestUid ?? account.sync?.last_uid,
            last_sync_at: formatCstIso(),
          },
        });
      },
      mailbox,
    );
  } catch (err) {
    return {
      account_id: accountId,
      upserted_messages: upsertedMessages,
      upserted_threads: upsertedThreads,
      highest_uid: highestUid,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    account_id: accountId,
    upserted_messages: upsertedMessages,
    upserted_threads: upsertedThreads,
    highest_uid: highestUid,
  };
}

export async function syncAllEmailAccounts(
  opts: { limit?: number } = {},
): Promise<EmailSyncResult[]> {
  const accounts = await listEnabledEmailAccountRows();
  const results: EmailSyncResult[] = [];
  for (const account of accounts) {
    results.push(await syncEmailAccount(account.id, opts));
  }
  return results;
}

export const emailSyncPortImpl = {
  syncAccount: syncEmailAccount,
  syncAll: syncAllEmailAccounts,
};

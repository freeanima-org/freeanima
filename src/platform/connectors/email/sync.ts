import { omitUndefined } from "@freeanima/core/util";
import {
  deriveThreadKey,
  findEmailMessageByImapUid,
  getEmailAccountRow,
  listEnabledEmailAccountRows,
  normalizeEmailSubject,
  updateEmailAccount,
  upsertEmailMessage,
  upsertEmailThread,
  worldIdForAccount,
  type EmailSyncResult,
} from "@freeanima/feature-email/domain";
import { formatCstIso } from "@freeanima/core/util";

import {
  extractBody,
  formatAddress,
  messagePreview,
  parseImapHeaderBuffer,
  withImapAccount,
} from "./imap-client.ts";

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
        await updateEmailAccount(await worldIdForAccount(account.id), {
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

export async function syncAllEmailAccounts(opts: {
  worldId: number;
  limit?: number;
}): Promise<EmailSyncResult[]> {
  const accounts = await listEnabledEmailAccountRows(opts.worldId);
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

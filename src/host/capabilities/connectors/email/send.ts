import { formatCstIso, omitUndefined } from "@freeanima/host/core/util";

import { getResolvedWorldContext } from "@freeanima/host/core/config";
import {
  deriveThreadKey,
  deleteEmailMessageRow,
  getEmailAccountRow,
  getEmailMessageRow,
  markEmailMessageRead,
  resolveEmailAccountRow,
  updateEmailMessageMailbox,
  upsertEmailMessage,
  upsertEmailThread,
  worldIdForAccount,
} from "@freeanima/features/email/domain";
import { messagePreview, smtpSecure, withImapAccount } from "./imap-client.ts";
import { resolveEmailAccountPassword } from "./password.ts";
import nodemailer from "nodemailer";

export type SendEmailInput = {
  account_id?: number;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
};

export type SaveDraftInput = {
  account_id?: number;
  to?: string;
  subject: string;
  body: string;
  message_id?: number;
};

function resolveSentMailbox(account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>) {
  return account.sent_mailbox ?? "Sent";
}

function resolveDraftsMailbox(
  account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>,
) {
  return account.drafts_mailbox ?? "Drafts";
}

function resolveTrashMailbox(account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>) {
  return account.trash_mailbox ?? "Trash";
}

function buildDraftMime(input: {
  account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>;
  to?: string;
  subject: string;
  body: string;
}): string {
  const from = input.account.display_name
    ? `${input.account.display_name} <${input.account.address}>`
    : input.account.address;
  const lines = [
    `From: ${from}`,
    ...(input.to ? [`To: ${input.to}`] : []),
    `Subject: ${input.subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ];
  return lines.join("\r\n");
}

function buildSentMime(input: {
  account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>;
  to: string;
  subject: string;
  body: string;
  messageId: string;
  cc?: string;
}): string {
  const from = input.account.display_name
    ? `${input.account.display_name} <${input.account.address}>`
    : input.account.address;
  const lines = [
    `From: ${from}`,
    `To: ${input.to}`,
    ...(input.cc ? [`Cc: ${input.cc}`] : []),
    `Subject: ${input.subject}`,
    `Message-ID: ${input.messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ];
  return lines.join("\r\n");
}

async function appendToMailbox(
  account: NonNullable<Awaited<ReturnType<typeof getEmailAccountRow>>>,
  mailbox: string,
  raw: string,
  flags: string[],
): Promise<number | null> {
  return withImapAccount(
    account,
    async (client, _box) => {
      const lock = await client.getMailboxLock(mailbox);
      try {
        const result = await client.append(mailbox, raw, flags);
        if (result && typeof result === "object" && "uid" in result && result.uid != null) {
          return Number(result.uid);
        }
        return null;
      } finally {
        lock.release();
      }
    },
    mailbox,
  );
}

export async function sendEmail(input: SendEmailInput): Promise<{
  ok: true;
  messageId: string;
  account_id: number;
  message_entity_id: number;
}> {
  const worldId =
    input.account_id != null
      ? await worldIdForAccount(input.account_id)
      : getResolvedWorldContext().agent_world_id;
  const account = await resolveEmailAccountRow(worldId, input.account_id);
  const pass = await resolveEmailAccountPassword(account);

  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: smtpSecure(account.smtp_port),
    auth: {
      user: account.address,
      pass,
    },
  });

  const info = await transport.sendMail({
    from: account.display_name
      ? { name: account.display_name, address: account.address }
      : account.address,
    to: input.to,
    cc: input.cc || undefined,
    bcc: input.bcc || undefined,
    subject: input.subject,
    text: input.body,
  });

  const sentAt = formatCstIso();
  const preview = messagePreview(input.body);
  const threadKey = deriveThreadKey({ subject: input.subject, message_id: info.messageId });
  const thread = await upsertEmailThread({
    account_id: account.id,
    thread_key: threadKey,
    subject: input.subject,
    preview,
    last_message_at: sentAt,
    message_delta: 1,
  });

  const sentMailbox = resolveSentMailbox(account);
  let imapUid: number | null = null;
  try {
    imapUid = await appendToMailbox(
      account,
      sentMailbox,
      buildSentMime({
        account,
        to: input.to,
        subject: input.subject,
        body: input.body,
        messageId: info.messageId,
        ...(input.cc ? { cc: input.cc } : {}),
      }),
      ["\\Seen"],
    );
  } catch {
    // SMTP 已成功；IMAP append 失败不阻断
  }

  const message = await upsertEmailMessage({
    account_id: account.id,
    thread_id: thread.id,
    subject: input.subject,
    preview,
    body: input.body,
    message_id: info.messageId,
    direction: "outbound",
    from: account.display_name ? `${account.display_name} <${account.address}>` : account.address,
    to: input.to,
    cc: input.cc ?? null,
    sent_at: sentAt,
    unread: false,
    imap_uid: imapUid,
    imap_mailbox: sentMailbox,
    flags: ["\\Seen"],
  });

  return {
    ok: true,
    messageId: info.messageId,
    account_id: account.id,
    message_entity_id: message.id,
  };
}

export async function saveDraft(input: SaveDraftInput): Promise<{
  ok: true;
  message_entity_id: number;
  imap_uid: number | null;
}> {
  const worldId =
    input.account_id != null
      ? await worldIdForAccount(input.account_id)
      : getResolvedWorldContext().agent_world_id;
  const account = await resolveEmailAccountRow(worldId, input.account_id);
  const draftsMailbox = resolveDraftsMailbox(account);
  const sentAt = formatCstIso();
  const preview = messagePreview(input.body);
  const raw = buildDraftMime(
    omitUndefined({
      account,
      to: input.to,
      subject: input.subject,
      body: input.body,
    }),
  );

  let imapUid: number | null = null;
  try {
    imapUid = await appendToMailbox(account, draftsMailbox, raw, ["\\Draft"]);
  } catch {
    // 本地仍保存草稿
  }

  if (input.message_id != null) {
    const existing = await getEmailMessageRow(input.message_id);
    if (!existing) throw new Error(`Email message not found: ${input.message_id}`);
    const updated = await upsertEmailMessage({
      account_id: account.id,
      thread_id: existing.thread_id,
      subject: input.subject,
      preview,
      body: input.body,
      direction: existing.direction,
      from: existing.from,
      to: input.to ?? existing.to,
      sent_at: existing.sent_at,
      unread: existing.unread,
      imap_uid: imapUid ?? existing.imap_uid,
      imap_mailbox: draftsMailbox,
      flags: ["\\Draft"],
    });
    return { ok: true, message_entity_id: updated.id, imap_uid: imapUid };
  }

  const threadKey = deriveThreadKey({ subject: input.subject });
  const thread = await upsertEmailThread({
    account_id: account.id,
    thread_key: threadKey,
    subject: input.subject,
    preview,
    last_message_at: sentAt,
    message_delta: 1,
  });
  const message = await upsertEmailMessage({
    account_id: account.id,
    thread_id: thread.id,
    subject: input.subject,
    preview,
    body: input.body,
    direction: "outbound",
    from: account.display_name ? `${account.display_name} <${account.address}>` : account.address,
    to: input.to ?? "",
    sent_at: sentAt,
    unread: false,
    imap_uid: imapUid,
    imap_mailbox: draftsMailbox,
    flags: ["\\Draft"],
  });
  return { ok: true, message_entity_id: message.id, imap_uid: imapUid };
}

export async function sendDraft(messageId: number): Promise<{
  ok: true;
  messageId: string;
  message_entity_id: number;
}> {
  const draft = await getEmailMessageRow(messageId);
  if (!draft) throw new Error(`Email message not found: ${messageId}`);
  const account = await getEmailAccountRow(draft.account_id);
  if (!account?.enabled) {
    throw new Error(`Email account not found or disabled: ${draft.account_id}`);
  }

  const result = await sendEmail({
    account_id: account.id,
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
    ...(draft.cc ? { cc: draft.cc } : {}),
  });

  if (draft.imap_uid != null && draft.imap_mailbox) {
    const draftUid = draft.imap_uid;
    const draftMailbox = draft.imap_mailbox;
    try {
      await withImapAccount(
        account,
        async (client, mailbox) => {
          const lock = await client.getMailboxLock(mailbox);
          try {
            await client.messageDelete(draftUid, { uid: true });
          } finally {
            lock.release();
          }
        },
        draftMailbox,
      );
    } catch {
      // 已发出；草稿夹删除失败不阻断
    }
  }

  await deleteEmailMessageRow(messageId);
  return {
    ok: true,
    messageId: result.messageId,
    message_entity_id: result.message_entity_id,
  };
}

export async function markMessageReadOnImap(messageId: number): Promise<{ ok: true }> {
  const message = await getEmailMessageRow(messageId);
  if (!message) throw new Error(`Email message not found: ${messageId}`);
  const account = await getEmailAccountRow(message.account_id);
  if (!account?.enabled) {
    throw new Error(`Email account not found or disabled: ${message.account_id}`);
  }

  if (message.imap_uid != null) {
    await withImapAccount(
      account,
      async (client, mailbox) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const imapUid = message.imap_uid;
          if (imapUid == null) return;
          await client.messageFlagsAdd(imapUid, ["\\Seen"], { uid: true });
        } finally {
          lock.release();
        }
      },
      message.imap_mailbox,
    );
  }

  await markEmailMessageRead(messageId, false);
  return { ok: true };
}

export async function markMessageUnreadOnImap(messageId: number): Promise<{ ok: true }> {
  const message = await getEmailMessageRow(messageId);
  if (!message) throw new Error(`Email message not found: ${messageId}`);
  const account = await getEmailAccountRow(message.account_id);
  if (!account?.enabled) {
    throw new Error(`Email account not found or disabled: ${message.account_id}`);
  }

  if (message.imap_uid != null) {
    await withImapAccount(
      account,
      async (client, mailbox) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const imapUid = message.imap_uid;
          if (imapUid == null) return;
          await client.messageFlagsRemove(imapUid, ["\\Seen"], { uid: true });
        } finally {
          lock.release();
        }
      },
      message.imap_mailbox,
    );
  }

  await markEmailMessageRead(messageId, true);
  return { ok: true };
}

export async function markMessageFlaggedOnImap(messageId: number): Promise<{ ok: true }> {
  const message = await getEmailMessageRow(messageId);
  if (!message) throw new Error(`Email message not found: ${messageId}`);
  const account = await getEmailAccountRow(message.account_id);
  if (!account?.enabled) {
    throw new Error(`Email account not found or disabled: ${message.account_id}`);
  }

  if (message.imap_uid != null) {
    await withImapAccount(
      account,
      async (client, mailbox) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const imapUid = message.imap_uid;
          if (imapUid == null) return;
          await client.messageFlagsAdd(imapUid, ["\\Flagged"], { uid: true });
        } finally {
          lock.release();
        }
      },
      message.imap_mailbox,
    );
  }

  const flags = [...new Set([...(message.flags ?? []), "\\Flagged"])];
  const { updateEmailMessageFlags } = await import("@freeanima/features/email/domain");
  await updateEmailMessageFlags(messageId, { unread: message.unread, flags });
  return { ok: true };
}

export async function markMessageUnflaggedOnImap(messageId: number): Promise<{ ok: true }> {
  const message = await getEmailMessageRow(messageId);
  if (!message) throw new Error(`Email message not found: ${messageId}`);
  const account = await getEmailAccountRow(message.account_id);
  if (!account?.enabled) {
    throw new Error(`Email account not found or disabled: ${message.account_id}`);
  }

  if (message.imap_uid != null) {
    await withImapAccount(
      account,
      async (client, mailbox) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const imapUid = message.imap_uid;
          if (imapUid == null) return;
          await client.messageFlagsRemove(imapUid, ["\\Flagged"], { uid: true });
        } finally {
          lock.release();
        }
      },
      message.imap_mailbox,
    );
  }

  const flags = (message.flags ?? []).filter((f) => f !== "\\Flagged");
  const { updateEmailMessageFlags } = await import("@freeanima/features/email/domain");
  await updateEmailMessageFlags(messageId, { unread: message.unread, flags });
  return { ok: true };
}

export async function moveMessageOnImap(
  messageId: number,
  targetMailbox: string,
): Promise<{ ok: true; imap_uid: number | null }> {
  const message = await getEmailMessageRow(messageId);
  if (!message) throw new Error(`Email message not found: ${messageId}`);
  const account = await getEmailAccountRow(message.account_id);
  if (!account?.enabled) {
    throw new Error(`Email account not found or disabled: ${message.account_id}`);
  }

  let nextUid: number | null = message.imap_uid;
  if (message.imap_uid != null && message.imap_mailbox !== targetMailbox) {
    nextUid = await withImapAccount(
      account,
      async (client, mailbox) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const imapUid = message.imap_uid;
          if (imapUid == null) return null;
          await client.messageMove(imapUid, targetMailbox, { uid: true });
          return imapUid;
        } finally {
          lock.release();
        }
      },
      message.imap_mailbox,
    );
  }

  await updateEmailMessageMailbox(messageId, {
    imap_mailbox: targetMailbox,
    imap_uid: nextUid,
  });
  return { ok: true, imap_uid: nextUid };
}

export async function deleteMessageOnImap(messageId: number): Promise<{ ok: true }> {
  const message = await getEmailMessageRow(messageId);
  if (!message) throw new Error(`Email message not found: ${messageId}`);
  const account = await getEmailAccountRow(message.account_id);
  if (!account?.enabled) {
    throw new Error(`Email account not found or disabled: ${message.account_id}`);
  }

  const policy = account.delete_policy ?? "move_to_trash";

  if (message.imap_uid != null) {
    await withImapAccount(
      account,
      async (client, mailbox) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const imapUid = message.imap_uid;
          if (imapUid == null) return;
          if (policy === "move_to_trash") {
            const trash = resolveTrashMailbox(account);
            if (mailbox !== trash) {
              await client.messageMove(imapUid, trash, { uid: true });
              return;
            }
          }
          await client.messageDelete(imapUid, { uid: true });
        } finally {
          lock.release();
        }
      },
      message.imap_mailbox,
    );
  }

  await deleteEmailMessageRow(messageId);
  return { ok: true };
}

import { formatCstIso } from "@freeanima/core/util";

import {
  deriveThreadKey,
  getEmailAccountRow,
  getEmailMessageRow,
  markEmailMessageRead,
  resolveEmailAccountRow,
  resolveEmailWorldId,
  worldIdForAccount,
  upsertEmailMessage,
  upsertEmailThread,
} from "@freeanima/feature-email/domain";
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

export async function sendEmail(input: SendEmailInput): Promise<{
  ok: true;
  messageId: string;
  account_id: number;
  message_entity_id: number;
}> {
  const worldId =
    input.account_id != null ? await worldIdForAccount(input.account_id) : resolveEmailWorldId();
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
  });

  return {
    ok: true,
    messageId: info.messageId,
    account_id: account.id,
    message_entity_id: message.id,
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

export async function deleteMessageOnImap(messageId: number): Promise<{ ok: true }> {
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
          await client.messageDelete(imapUid, { uid: true });
        } finally {
          lock.release();
        }
      },
      message.imap_mailbox,
    );
  }

  const { deleteEmailMessageRow } = await import("@freeanima/feature-email/domain");
  await deleteEmailMessageRow(messageId);
  return { ok: true };
}

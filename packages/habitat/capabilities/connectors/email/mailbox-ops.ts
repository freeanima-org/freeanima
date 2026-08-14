import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  getEmailAccountRow,
  updateEmailAccount,
  worldIdForAccount,
  type EmailAccountRow,
} from "@freeanima/features/email/domain";
import type { ListedMailbox } from "./sync.ts";
import { withImapAccount } from "./imap-client.ts";
import type { ImapFlow } from "imapflow";

async function listMailboxesFromClient(client: ImapFlow): Promise<ListedMailbox[]> {
  const mailboxes: ListedMailbox[] = [];
  const listed = await client.list();
  for (const entry of listed) {
    mailboxes.push(
      omitUndefined({
        path: entry.path,
        name: entry.name,
        special_use: entry.specialUse,
        subscribed: entry.subscribed,
      }),
    );
  }
  return mailboxes;
}

async function persistMailboxPaths(account: EmailAccountRow, mailboxes: ListedMailbox[]) {
  const paths = mailboxes.map((m) => m.path);
  await updateEmailAccount(await worldIdForAccount(account.id), {
    id: account.id,
    mailbox_paths: paths,
  });
}

export async function createMailbox(
  accountId: number,
  path: string,
): Promise<{ ok: true; path: string; mailboxes: ListedMailbox[] }> {
  const account = await getEmailAccountRow(accountId);
  if (!account?.enabled) throw new Error("account not found or disabled");

  const mailboxes = await withImapAccount(account, async (client) => {
    await client.mailboxCreate(path);
    return listMailboxesFromClient(client);
  });
  await persistMailboxPaths(account, mailboxes);
  return { ok: true, path, mailboxes };
}

export async function renameMailbox(
  accountId: number,
  from: string,
  to: string,
): Promise<{ ok: true; from: string; to: string; mailboxes: ListedMailbox[] }> {
  const account = await getEmailAccountRow(accountId);
  if (!account?.enabled) throw new Error("account not found or disabled");

  const mailboxes = await withImapAccount(account, async (client) => {
    await client.mailboxRename(from, to);
    return listMailboxesFromClient(client);
  });

  await updateEmailAccount(
    await worldIdForAccount(account.id),
    omitUndefined({
      id: account.id,
      mailbox_paths: mailboxes.map((m) => m.path),
      sent_mailbox: account.sent_mailbox === from ? to : account.sent_mailbox,
      trash_mailbox: account.trash_mailbox === from ? to : account.trash_mailbox,
      drafts_mailbox: account.drafts_mailbox === from ? to : account.drafts_mailbox,
    }),
  );
  return { ok: true, from, to, mailboxes };
}

export async function deleteMailbox(
  accountId: number,
  path: string,
): Promise<{ ok: true; path: string; mailboxes: ListedMailbox[] }> {
  const account = await getEmailAccountRow(accountId);
  if (!account?.enabled) throw new Error("account not found or disabled");

  const mailboxes = await withImapAccount(account, async (client) => {
    await client.mailboxDelete(path);
    return listMailboxesFromClient(client);
  });

  await updateEmailAccount(
    await worldIdForAccount(account.id),
    omitUndefined({
      id: account.id,
      mailbox_paths: mailboxes.map((m) => m.path),
      sent_mailbox: account.sent_mailbox === path ? null : undefined,
      trash_mailbox: account.trash_mailbox === path ? null : undefined,
      drafts_mailbox: account.drafts_mailbox === path ? null : undefined,
    }),
  );
  return { ok: true, path, mailboxes };
}

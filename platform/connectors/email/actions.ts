import { ImapFlow } from "imapflow";

import { resolveAccount, resolveAccountPassword } from "./accounts.ts";

function imapSecure(port: number): boolean {
  return port >= 993;
}

async function withImapAccount<T>(
  accountId: string,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const account = resolveAccount(accountId);
  const pass = await resolveAccountPassword(account);
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: imapSecure(account.imap_port),
    auth: {
      user: account.address,
      pass,
    },
    logger: false,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function markAsRead(accountId: string, uid: number): Promise<{ ok: true }> {
  await withImapAccount(accountId, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  });
  return { ok: true };
}

export async function deleteEmail(accountId: string, uid: number): Promise<{ ok: true }> {
  await withImapAccount(accountId, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageDelete(uid, { uid: true });
    } finally {
      lock.release();
    }
  });
  return { ok: true };
}

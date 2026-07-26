import {
  getEmailAccountRow,
  listAllEnabledEmailAccountRows,
  type EmailAccountRow,
} from "@freeanima/features/email/domain";
import { normalizeAccountSync } from "@freeanima/features/email/domain/sync-state";

import { notifyNewMailFromSyncResults } from "./new-mail-notify.ts";

import { withImapAccount } from "./imap-client.ts";
import { syncEmailAccount } from "./sync.ts";

type IdleHandle = {
  stop: () => void;
};

const handles = new Map<number, IdleHandle>();
const syncDebounce = new Map<number, ReturnType<typeof setTimeout>>();

function resolveInboxPath(account: EmailAccountRow): string {
  const sync = normalizeAccountSync(account.sync);
  for (const [path, cursor] of Object.entries(sync.mailboxes)) {
    if (cursor.special_use === "inbox") return path;
  }
  const inbox = account.mailbox_paths?.find((p) => p.toUpperCase() === "INBOX");
  return inbox ?? "INBOX";
}

function scheduleSync(accountId: number): void {
  const prev = syncDebounce.get(accountId);
  if (prev) clearTimeout(prev);
  syncDebounce.set(
    accountId,
    setTimeout(() => {
      syncDebounce.delete(accountId);
      void syncEmailAccount(accountId)
        .then(async (result) => {
          await notifyNewMailFromSyncResults([result]);
        })
        .catch(() => {});
    }, 1500),
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function startEmailIdleForAccount(accountId: number): Promise<void> {
  stopEmailIdleForAccount(accountId);

  const account = await getEmailAccountRow(accountId);
  if (!account?.enabled) return;

  const inbox = resolveInboxPath(account);
  let stopped = false;

  const loop = async (): Promise<void> => {
    while (true) {
      if (stopped) break;
      try {
        await withImapAccount(
          account,
          async (client, mailbox) => {
            const lock = await client.getMailboxLock(mailbox);
            try {
              while (true) {
                if (stopped) break;
                try {
                  await client.idle();
                  scheduleSync(accountId);
                } catch {
                  break;
                }
              }
            } finally {
              lock.release();
            }
          },
          inbox,
        );
      } catch {
        if (stopped) break;
        await sleepMs(10_000);
      }
    }
  };

  void loop();
  handles.set(accountId, {
    stop: () => {
      stopped = true;
    },
  });
}

export function stopEmailIdleForAccount(accountId: number): void {
  const h = handles.get(accountId);
  if (h) {
    h.stop();
    handles.delete(accountId);
  }
  const t = syncDebounce.get(accountId);
  if (t) {
    clearTimeout(t);
    syncDebounce.delete(accountId);
  }
}

export async function startEmailIdleForAllEnabledAccounts(): Promise<void> {
  const accounts = await listAllEnabledEmailAccountRows();
  for (const account of accounts) {
    await startEmailIdleForAccount(account.id);
  }
}

export function stopAllEmailIdle(): void {
  const ids = Array.from(handles.keys());
  for (const id of ids) stopEmailIdleForAccount(id);
}

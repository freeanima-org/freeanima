import { ImapFlow } from "imapflow";

import { readAccountPassword, resolveEnabledAccounts } from "./accounts.ts";
import type { EmailAccount } from "./types.ts";
import type { EmailFilter, EmailMessage } from "./types.ts";
import { emailFilterSchema } from "./types.ts";

function imapSecure(port: number): boolean {
  return port >= 993;
}

function formatAddress(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "address" in raw) {
    const addr = raw as { name?: string; address?: string };
    if (addr.name) return `${addr.name} <${addr.address ?? ""}>`;
    return addr.address ?? "";
  }
  return String(raw ?? "");
}

function messagePreview(body: string, max = 200): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function extractBody(source: unknown): string {
  if (typeof source === "string") return source;
  if (Buffer.isBuffer(source)) return source.toString("utf-8");
  return "";
}

async function withImapClient<T>(
  account: EmailAccount,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: imapSecure(account.imap_port),
    auth: {
      user: account.address,
      pass: readAccountPassword(account),
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

function buildSearchQuery(filter?: EmailFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter?.unread) query.seen = false;
  if (filter?.since) query.since = new Date(filter.since);
  if (filter?.from) query.from = filter.from;
  if (filter?.subject) query.subject = filter.subject;
  return query;
}

async function fetchMessagesForAccount(
  account: EmailAccount,
  filter?: EmailFilter,
  includeBody = false,
): Promise<EmailMessage[]> {
  const limit = filter?.limit ?? 20;

  return withImapClient(account, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const query = buildSearchQuery(filter);
      const hasQuery = Object.keys(query).length > 0;
      const uids = hasQuery
        ? await client.search(query, { uid: true })
        : await client.search({ all: true }, { uid: true });

      const uidList = (uids as number[]).slice(-limit).toReversed();
      const messages: EmailMessage[] = [];

      for (const uid of uidList) {
        const msg = await client.fetchOne(
          uid,
          {
            envelope: true,
            flags: true,
            source: includeBody,
            bodyStructure: !includeBody,
          },
          { uid: true },
        );
        if (!msg) continue;

        let body = "";
        if (includeBody) {
          body = extractBody(msg.source);
        } else if (msg.bodyStructure) {
          const part = await client.download(uid, "1", { uid: true }).catch(() => null);
          if (part?.content) {
            const chunks: Buffer[] = [];
            for await (const chunk of part.content) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            body = Buffer.concat(chunks).toString("utf-8");
          }
        }

        const envelope = msg.envelope;
        messages.push({
          uid,
          account_id: account.id,
          from: formatAddress(envelope?.from?.[0]),
          to: formatAddress(envelope?.to?.[0]),
          subject: envelope?.subject ?? "(无主题)",
          date: envelope?.date?.toISOString() ?? "",
          preview: messagePreview(body),
          unread: !msg.flags?.has("\\Seen"),
          ...(includeBody ? { body } : {}),
        });
      }

      return messages;
    } finally {
      lock.release();
    }
  });
}

export async function fetchEmails(accountId?: string, limit?: number): Promise<EmailMessage[]> {
  const filter = emailFilterSchema.parse({ limit });
  const accounts = resolveEnabledAccounts(accountId);
  const batches = await Promise.all(
    accounts.map((account) => fetchMessagesForAccount(account, filter)),
  );
  return batches.flat();
}

export async function listEmails(
  accountId?: string,
  filter?: EmailFilter,
): Promise<EmailMessage[]> {
  const parsed = emailFilterSchema.parse(filter ?? {});
  const accounts = resolveEnabledAccounts(accountId);
  const batches = await Promise.all(
    accounts.map((account) => fetchMessagesForAccount(account, parsed)),
  );
  return batches.flat();
}

export async function readEmail(accountId: string, uid: number): Promise<EmailMessage> {
  const account = resolveEnabledAccounts(accountId)[0]!;
  const direct = await withImapClient(account, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(
        uid,
        { envelope: true, flags: true, source: true },
        { uid: true },
      );
      if (!msg) return null;

      const body = extractBody(msg.source);
      const envelope = msg.envelope;
      return {
        uid,
        account_id: account.id,
        from: formatAddress(envelope?.from?.[0]),
        to: formatAddress(envelope?.to?.[0]),
        subject: envelope?.subject ?? "(无主题)",
        date: envelope?.date?.toISOString() ?? "",
        preview: messagePreview(body),
        unread: !msg.flags?.has("\\Seen"),
        body,
      } satisfies EmailMessage;
    } finally {
      lock.release();
    }
  });

  if (!direct) {
    throw new Error(`邮件不存在: account=${accountId} uid=${uid}`);
  }
  return direct;
}

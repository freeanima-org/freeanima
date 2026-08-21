import { omitUndefined } from "@freeanima/habitat/core/util";
import { ImapFlow } from "imapflow";
import { asRecord } from "@freeanima/shared/util";

import type { EmailAccountRow } from "@freeanima/features/email/domain";

import { resolveEmailAccountPassword } from "./password.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export function imapSecure(port: number): boolean {
  return port >= 993;
}

export function smtpSecure(port: number): boolean {
  if (port === 465) return true;
  if (port === 587 || port === 25) return false;
  return port > 465;
}

export function formatAddress(raw: unknown): string {
  if (typeof raw === "string") return raw;
  const addr = asRecord(raw);
  if (addr && "address" in addr) {
    const name = typeof addr.name === "string" ? addr.name : undefined;
    const address = typeof addr.address === "string" ? addr.address : "";
    if (name) return `${name} <${address}>`;
    return address;
  }
  return coerceString(raw ?? "");
}

export function messagePreview(body: string, max = 200): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function extractBody(source: unknown): string {
  if (typeof source === "string") return source;
  if (Buffer.isBuffer(source)) return source.toString("utf-8");
  return "";
}

function parseReferencesHeader(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function readHeaderLine(text: string, name: string): string | undefined {
  const re = new RegExp(`^${name}:\\s*(.+)$`, "im");
  const match = text.match(re);
  return match?.[1]?.trim();
}

/** imapflow 的 `headers` 字段是 Buffer，不是 Map。 */
export function parseImapHeaderBuffer(headers: unknown): {
  messageId?: string;
  inReplyTo?: string;
  references: string[];
} {
  if (Buffer.isBuffer(headers)) {
    const text = headers.toString("utf-8");
    return omitUndefined({
      messageId: readHeaderLine(text, "Message-ID"),
      inReplyTo: readHeaderLine(text, "In-Reply-To"),
      references: parseReferencesHeader(readHeaderLine(text, "References")),
    });
  }
  if (headers instanceof Map) {
    const getFirst = (key: string): string | undefined => {
      const v: unknown = headers.get(key);
      if (Array.isArray(v) && typeof v[0] === "string") return v[0];
      if (typeof v === "string") return v;
      return undefined;
    };
    return omitUndefined({
      messageId: getFirst("message-id"),
      inReplyTo: getFirst("in-reply-to"),
      references: parseReferencesHeader(getFirst("references")),
    });
  }
  return { references: [] };
}

export async function withImapAccount<T>(
  account: EmailAccountRow,
  fn: (client: ImapFlow, mailbox: string) => Promise<T>,
  mailbox = "INBOX",
): Promise<T> {
  const pass = await resolveEmailAccountPassword(account);
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
    return await fn(client, mailbox);
  } finally {
    await client.logout().catch(() => {});
  }
}

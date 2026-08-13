import { omitUndefined } from "@freeanima/host/core/util";
import type {
  EmailAccountSync,
  EmailMailboxSpecialUse,
  EmailMailboxSyncCursor,
} from "@freeanima/host/core/db/schema/entity";

export type NormalizedEmailAccountSync = {
  mailboxes: Record<string, EmailMailboxSyncCursor>;
};

/** Fold legacy single-cursor sync into per-mailbox map. */
export function normalizeAccountSync(
  sync: EmailAccountSync | undefined | null,
): NormalizedEmailAccountSync {
  const mailboxes: Record<string, EmailMailboxSyncCursor> = {
    ...sync?.mailboxes,
  };

  const legacyMailbox = sync?.mailbox?.trim() || "INBOX";
  const hasLegacyCursor =
    sync?.uidvalidity != null || sync?.last_uid != null || sync?.last_sync_at != null;

  if (Object.keys(mailboxes).length === 0 || hasLegacyCursor) {
    const existing = mailboxes[legacyMailbox] ?? {};
    mailboxes[legacyMailbox] = {
      ...existing,
      ...(sync?.uidvalidity != null ? { uidvalidity: sync.uidvalidity } : {}),
      ...(sync?.last_uid != null ? { last_uid: sync.last_uid } : {}),
      ...(sync?.last_sync_at != null ? { last_sync_at: sync.last_sync_at } : {}),
      special_use:
        existing.special_use ?? (legacyMailbox.toUpperCase() === "INBOX" ? "inbox" : undefined),
    };
  }

  if (!mailboxes["INBOX"] && !Object.values(mailboxes).some((c) => c.special_use === "inbox")) {
    mailboxes["INBOX"] = { special_use: "inbox" };
  }

  return { mailboxes };
}

export function getMailboxCursor(
  sync: EmailAccountSync | undefined | null,
  mailbox: string,
): EmailMailboxSyncCursor {
  const normalized = normalizeAccountSync(sync);
  return normalized.mailboxes[mailbox] ?? {};
}

export function setMailboxCursor(
  sync: EmailAccountSync | undefined | null,
  mailbox: string,
  cursor: EmailMailboxSyncCursor,
): NormalizedEmailAccountSync {
  const normalized = normalizeAccountSync(sync);
  return {
    mailboxes: {
      ...normalized.mailboxes,
      [mailbox]: { ...normalized.mailboxes[mailbox], ...cursor },
    },
  };
}

export type ListedMailbox = {
  path: string;
  special_use?: EmailMailboxSpecialUse;
};

const SPECIAL_NAME_HEURISTICS: Array<{ use: EmailMailboxSpecialUse; patterns: RegExp[] }> = [
  { use: "inbox", patterns: [/^inbox$/i] },
  {
    use: "sent",
    patterns: [/^sent$/i, /^sent messages$/i, /^sent items$/i, /已发送/, /\[gmail\]\/sent/i],
  },
  {
    use: "drafts",
    patterns: [/^drafts?$/i, /草稿/, /\[gmail\]\/drafts/i],
  },
  {
    use: "trash",
    patterns: [
      /^trash$/i,
      /^deleted$/i,
      /^deleted items$/i,
      /已删除/,
      /回收站/,
      /\[gmail\]\/trash/i,
    ],
  },
  {
    use: "junk",
    patterns: [/^junk$/i, /^spam$/i, /垃圾/, /\[gmail\]\/spam/i],
  },
  {
    use: "archive",
    patterns: [/^archive$/i, /归档/, /\[gmail\]\/all mail/i],
  },
];

export function inferSpecialUseFromPath(path: string): EmailMailboxSpecialUse | undefined {
  const leaf = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
  for (const row of SPECIAL_NAME_HEURISTICS) {
    if (row.patterns.some((re) => re.test(path) || re.test(leaf))) return row.use;
  }
  return undefined;
}

/** Map IMAP SPECIAL-USE flag names to our enum. */
export function specialUseFromImapFlags(
  flags: Iterable<string>,
): EmailMailboxSpecialUse | undefined {
  const set = new Set([...flags].map((f) => f.toLowerCase()));
  if (set.has("\\inbox") || set.has("inbox")) return "inbox";
  if (set.has("\\sent") || set.has("sent")) return "sent";
  if (set.has("\\drafts") || set.has("drafts")) return "drafts";
  if (set.has("\\trash") || set.has("trash")) return "trash";
  if (set.has("\\junk") || set.has("junk")) return "junk";
  if (set.has("\\archive") || set.has("archive")) return "archive";
  return undefined;
}

export function resolveSpecialMailboxes(
  listed: ListedMailbox[],
  existing?: {
    sent_mailbox?: string;
    trash_mailbox?: string;
    drafts_mailbox?: string;
  },
): {
  inbox: string;
  sent_mailbox?: string;
  trash_mailbox?: string;
  drafts_mailbox?: string;
  paths: string[];
  byUse: Partial<Record<EmailMailboxSpecialUse, string>>;
} {
  const byUse: Partial<Record<EmailMailboxSpecialUse, string>> = {};
  const paths: string[] = [];

  for (const box of listed) {
    paths.push(box.path);
    const use = box.special_use ?? inferSpecialUseFromPath(box.path);
    if (use && byUse[use] == null) byUse[use] = box.path;
  }

  const inbox = byUse.inbox ?? paths.find((p) => p.toUpperCase() === "INBOX") ?? "INBOX";
  byUse.inbox = inbox;

  return omitUndefined({
    inbox,
    sent_mailbox: existing?.sent_mailbox ?? byUse.sent,
    trash_mailbox: existing?.trash_mailbox ?? byUse.trash,
    drafts_mailbox: existing?.drafts_mailbox ?? byUse.drafts,
    paths: paths.length > 0 ? paths : [inbox],
    byUse,
  });
}

/** Mailboxes to sync by default: system roles + any with existing cursors. */
export function defaultSyncMailboxPaths(
  resolved: ReturnType<typeof resolveSpecialMailboxes>,
  sync: EmailAccountSync | undefined | null,
): string[] {
  const normalized = normalizeAccountSync(sync);
  const set = new Set<string>();
  set.add(resolved.inbox);
  if (resolved.sent_mailbox) set.add(resolved.sent_mailbox);
  if (resolved.drafts_mailbox) set.add(resolved.drafts_mailbox);
  if (resolved.trash_mailbox) set.add(resolved.trash_mailbox);
  for (const path of Object.keys(normalized.mailboxes)) set.add(path);
  return [...set];
}

/** @deprecated alias */
export const mailboxesToSync = defaultSyncMailboxPaths;

/** FLAGS 刷新 UID 集合：本地已有 UID ∪ recent window。 */
export function collectFlagRefreshUids(
  localUids: number[],
  lastUid: number | undefined,
  window = 100,
): number[] {
  const set = new Set(localUids.filter((uid) => uid > 0));
  if (lastUid != null && lastUid > 0) {
    const start = Math.max(1, lastUid - window + 1);
    for (let uid = start; uid <= lastUid; uid += 1) {
      set.add(uid);
    }
  }
  return [...set].toSorted((a, b) => a - b);
}

export function isMessageFlagged(flags: string[]): boolean {
  return flags.includes("\\Flagged");
}

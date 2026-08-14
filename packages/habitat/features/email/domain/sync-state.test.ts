import { describe, expect, it } from "bun:test";

import {
  collectFlagRefreshUids,
  getMailboxCursor,
  isMessageFlagged,
  normalizeAccountSync,
  resolveSpecialMailboxes,
  setMailboxCursor,
} from "./sync-state.ts";

describe("normalizeAccountSync", () => {
  it("folds legacy single cursor into mailboxes[INBOX]", () => {
    const normalized = normalizeAccountSync({
      mailboxes: {},
      mailbox: "INBOX",
      uidvalidity: 42,
      last_uid: 100,
      last_sync_at: "2026-07-25T08:00:00+08:00",
    });

    expect(normalized.mailboxes.INBOX).toEqual({
      uidvalidity: 42,
      last_uid: 100,
      last_sync_at: "2026-07-25T08:00:00+08:00",
      special_use: "inbox",
    });
  });

  it("preserves per-mailbox cursors", () => {
    const normalized = normalizeAccountSync({
      mailboxes: {
        INBOX: { last_uid: 5, special_use: "inbox" },
        "[Gmail]/Sent Mail": { last_uid: 2, special_use: "sent" },
      },
    });
    expect(normalized.mailboxes.INBOX?.last_uid).toBe(5);
    expect(normalized.mailboxes["[Gmail]/Sent Mail"]?.last_uid).toBe(2);
  });
});

describe("getMailboxCursor / setMailboxCursor", () => {
  it("round-trips mailbox cursor", () => {
    const next = setMailboxCursor(undefined, "INBOX", {
      last_uid: 10,
      special_use: "inbox",
    });
    expect(getMailboxCursor({ mailboxes: next.mailboxes }, "INBOX").last_uid).toBe(10);
  });
});

describe("resolveSpecialMailboxes", () => {
  it("uses LIST special-use then path heuristics", () => {
    const resolved = resolveSpecialMailboxes([
      { path: "INBOX", special_use: "inbox" },
      { path: "Sent", special_use: "sent" },
      { path: "Drafts", special_use: "drafts" },
      { path: "Trash", special_use: "trash" },
    ]);
    expect(resolved.inbox).toBe("INBOX");
    expect(resolved.sent_mailbox).toBe("Sent");
    expect(resolved.drafts_mailbox).toBe("Drafts");
    expect(resolved.trash_mailbox).toBe("Trash");
  });
});

describe("collectFlagRefreshUids", () => {
  it("merges local uids with recent window", () => {
    expect(collectFlagRefreshUids([50, 200], 105, 10)).toEqual([
      50, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 200,
    ]);
  });
});

describe("isMessageFlagged", () => {
  it("detects \\Flagged", () => {
    expect(isMessageFlagged(["\\Seen", "\\Flagged"])).toBe(true);
    expect(isMessageFlagged(["\\Seen"])).toBe(false);
  });
});

describe("parseEmailMessageSearchFilters", () => {
  it("accepts extended email_message filter shape", async () => {
    const { parseEmailMessageSearchFilters } =
      await import("@freeanima/habitat/core/db/schema/entity/search-filters.ts");
    const parsed = parseEmailMessageSearchFilters({
      account_id: 1,
      imap_mailbox: "INBOX",
      message_id: "<abc@example.com>",
      to: "user@example.com",
      subject: "invoice",
      flagged: true,
      has_attachment: true,
      unread: false,
    });
    expect(parsed.imap_mailbox).toBe("INBOX");
    expect(parsed.message_id).toBe("<abc@example.com>");
    expect(parsed.to).toBe("user@example.com");
    expect(parsed.subject).toBe("invoice");
    expect(parsed.flagged).toBe(true);
    expect(parsed.has_attachment).toBe(true);
  });
});

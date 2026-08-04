---
title: Email module
---

# Email module

Habitat-backed IMAP/SMTP mail client (`/email`). Entity model: [`docs/product/entity-model.md`](../product/entity-model.md) (Email module).

## Capabilities

- Multi-mailbox sync (INBOX / Sent / Drafts / Trash + custom); LIST + SPECIAL-USE
- Flags: `\Seen` / `\Flagged` write-back and FLAGS refresh on sync
- Send: SMTP + APPEND Sent; drafts in Drafts mailbox
- Delete: move to Trash (default); mailbox CREATE/RENAME/DELETE
- IDLE on inbox + in-process `Bun.cron` `builtin-email-sync-all` every 5m across **all worlds** (enabled accounts; not PG `cron_jobs` / `cron_log`); auto-sync new inbox mail → **one notification per owning subject** (user vs agent world) with body carrying `from` + `message_id` (entity id for `email_read`); manual `email.sync` does not notify
- Local hybrid search (synced messages only)
- List multi-select: mark read/unread, star, move, delete (serial RPC)

## Habitat RPC (selected)

`email.mailbox.list|create|rename|delete`, `email.message.list|read|markRead|markUnread|markFlagged|markUnflagged|move|delete|search`, `email.send`, `email.draft.save|send`, `email.sync`, `emailaccount.*`.

## Tools

ToolSets `email-account` and `email` (`email_sync`, `email_list`, `email_search`, `email_mark_read`, `email_mark_flagged`, `email_move`, …).

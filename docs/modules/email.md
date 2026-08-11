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
- Attachments: sync → `createObjectFile` → `body.attachments[].object_file_id`；下载走 `object_storage.file.get`；删信/删账户时软删关联 `object_file`
- Send with attachments: `email.attachment.upload`（multipart / 粘贴本地文件）或对象库已有 `object_file_id` → `email.send` `attachment_object_file_ids` → SMTP + Sent APPEND multipart MIME
  - Compose UI：选文件、粘贴（含截图）、从本 world 对象库扁平列表勾选

## Habitat RPC (selected)

`email.mailbox.list|create|rename|delete`, `email.message.list|read|markRead|markUnread|markFlagged|markUnflagged|move|delete|search`, `email.send`, `email.attachment.upload`, `email.draft.save|send`, `email.sync`, `emailaccount.*`.

## Tools

ToolSets `email-account` and `email` (`email_sync`, `email_list`, `email_search`, `email_mark_read`, `email_mark_flagged`, `email_move`, …).

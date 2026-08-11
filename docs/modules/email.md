---
title: Email module
---

# Email module

Habitat-backed IMAP/SMTP mail client (`/email`). Entity model: [`docs/product/entity-model.md`](../product/entity-model.md) (Email module).

## Capabilities

- Multi-mailbox sync (INBOX / Sent / Drafts / Trash + custom); LIST + SPECIAL-USE
- Flags: `\Seen` / `\Flagged` write-back and FLAGS refresh on sync
- Send: SMTP + **Search-then-APPEND** Sent（SMTP 后按 Message-ID SEARCH；服务商已自动存 Sent 则跳过 APPEND，避免双份）；drafts in Drafts mailbox
- Self-send: expected **one row in INBOX and one in Sent** (same RFC Message-ID, different `imap_mailbox`); same-mailbox Message-ID dedupe prevents a second Sent UID becoming a second local `email_message`
- Delete: move to Trash (default); mailbox CREATE/RENAME/DELETE
- IDLE on inbox + in-process `Bun.cron` `builtin-email-sync-all` every 5m across **all worlds** (enabled accounts; not PG `cron_jobs` / `cron_log`); auto-sync new inbox mail → **one notification per owning subject** (user vs agent world) with body carrying `from` + `message_id` (entity id for `email_read`); manual `email.sync` does not notify
- Do not run **`anima service` and `just dev habitat` against the same PG / `FREEANIMA_HOME`** (both IDLE/cron sync the same accounts)
- Local hybrid search (synced messages only)
- List multi-select: mark read/unread, star, move, delete (serial RPC)
- Attachments: sync → `createObjectFile` → `body.attachments[].object_file_id`；下载走 `object_storage.file.get`；删信/删账户时软删关联 `object_file`
- Send with attachments: `email.attachment.upload`（multipart / 粘贴本地文件）或对象库已有 `object_file_id` → `email.send` `attachment_object_file_ids` → SMTP + Sent copy (search-then-append) multipart MIME
  - Compose UI：选文件、粘贴（含截图）、从本 world 对象库扁平列表勾选

## Habitat RPC (selected)

`email.mailbox.list|create|rename|delete`, `email.message.list|read|markRead|markUnread|markFlagged|markUnflagged|move|delete|search`, `email.message.attachTask` / `email.message.detachTask`，`email.send`, `email.attachment.upload`, `email.draft.save|send`, `email.sync`, `emailaccount.*`.

### 邮件挂任务（attach）

- 同 `entities.id`：`components` 追加 `task_item`，**primary 仍为 `email_message`**（见 [`entity-model.md`](../product/entity-model.md) Morph）。
- 默认 Inbox；可选 `due_at` / `remind_at`（提醒依赖 due）。
- 卸任务：`detachTask` 或清单侧 `task.delete`（对非 primary 的 task facet → 只 detach，不删邮件）。
- 清单 / 提醒认 `components` 含 `task_item`。

## Tools

ToolSets `email-account` and `email`（含 `email_attach_task` / `email_detach_task`，以及 `email_sync`、`email_list`、`email_search`、…）。

---
title: 邮件模块
---

# 邮件模块

栖息地侧 IMAP/SMTP 邮件客户端（`/email`）。实体模型：[`docs/product/entity-model.md`](../product/entity-model.md)（Email 模块）。

## 能力

- 多邮箱同步（INBOX / Sent / Drafts / Trash + 自定义）；LIST + SPECIAL-USE
- 标志：`\Seen` / `\Flagged` 回写，同步时刷新 FLAGS
- 发送：SMTP + **先 SEARCH 再 APPEND** Sent（SMTP 后按 Message-ID SEARCH；服务商已自动存 Sent 则跳过 APPEND，避免双份）；草稿在 Drafts 邮箱
- 自发自收：期望 **INBOX 一行 + Sent 一行**（同一 RFC Message-ID，不同 `imap_mailbox`）；同邮箱 Message-ID 去重防止第二个 Sent UID 变成第二条本地 `email_message`
- 删除：默认移到 Trash；邮箱 CREATE/RENAME/DELETE
- 收件箱 IDLE + 进程内 `Bun.cron` `builtin-email-sync-all` 每 5 分钟跨**所有 World**（已启用账户；非 PG `cron_jobs` / `cron_log`）；新收件自动同步 → **每个拥有 subject 一条通知**（user vs agent World），正文含 `from` + `message_id`（供 `email_read` 的实体 id）；手动 `email.sync` 不通知
- **不要**对同一 PG / `FREEANIMA_HOME` 同时跑 **`anima service` 与 `just dev habitat`**（两者都会 IDLE/cron 同步同一批账户）
- 本地混合搜索（仅已同步消息）
- 列表多选：标已读/未读、加星、移动、删除（串行 RPC）
- 附件：同步 → `createObjectFile` → `body.attachments[].object_file_id`；下载走 `object_storage.file.get`；删信/删账户时软删关联 `object_file`
- 带附件发送：`email.attachment.upload`（multipart / 粘贴本地文件）或对象库已有 `object_file_id` → `email.send` `attachment_object_file_ids` → SMTP + Sent 副本（search-then-append）multipart MIME
  - 撰写 UI：选文件、粘贴（含截图）、从本 World 对象库扁平列表勾选

## 栖息地 RPC（节选）

`email.mailbox.list|create|rename|delete`，
`email.message.list|read|markRead|markUnread|markFlagged|markUnflagged|move|delete|search`，
`email.message.attachTask` / `email.message.detachTask`，`email.send`，
`email.attachment.upload`，`email.draft.save|send`，`email.sync`，
`emailaccount.*`。

### 邮件挂任务（attach）

- 同 `entities.id`：`components` 追加 `task_item`，**primary 仍为 `email_message`**（见 [`entity-model.md`](../product/entity-model.md) Morph）。
- 默认 Inbox；可选 `due_at` / `remind_at`（提醒依赖 due）。
- 卸任务：`detachTask` 或清单侧 `task.delete`（对非 primary 的 task facet → 只 detach，不删邮件）。
- 清单 / 提醒认 `components` 含 `task_item`。

## 工具

ToolSet `email-account` 与 `email`（含 `email_attach_task` / `email_detach_task`，以及 `email_sync`、`email_list`、`email_search`、…）。

---
title: Chat
---

# Chat — 离线发送与多端冲突

Chat SPA 支持 **离线写入 outbox**、上线后 **自动重试**，并通过 Habitat 侧幂等与 tail CAS 避免重复发送与陈旧消息。

## 用户未读

Chat 维护 **用户已读水位**（`conversation_read_state`，按 Habitat user subject）：

- 会话未读：存在 `role=assistant` 且 `pos > last_read_pos` 的消息。
- `conversation.list` 返回 `unread`；`conversation.unreadCount` 返回未归档未读会话数（Shell 角标）。
- 打开会话或正在查看时流式结束后调用 `conversation.markRead`（水位单调升高）。
- `conversation.subscribeInbox`（WS）在任意会话更新时推送 `conversation.updated`，供列表与角标刷新。

用户自己发送的消息不构成未读；不做 agent 未读分区。

## 客户端

- 发送先入 IndexedDB `outbox`（`moduleId: chat`），并乐观显示 user bubble（`sendStatus: pending`）。
- 离线时可输入并发送；消息排队，Habitat 恢复后按 FIFO 重试。
- 重试前调用 `conversation.tail` 对比入队时的 `expected_tail_pos`。
- **tail 不一致**（会话已在别端继续）：标记 `stale`，默认不发送；用户可 **丢弃** 或 **仍要发送**（`force_tail`）。

## Habitat 协议

`message.send` 可选字段：

| 字段                | 说明                                 |
| ------------------- | ------------------------------------ |
| `client_op_id`      | 幂等键；重复请求不重复写入 user 消息 |
| `expected_tail_pos` | 发送时观测的 `max(pos)`，空会话为 0  |
| `force_tail`        | 跳过 CAS，追加到当前末尾             |

`conversation.tail` 返回 `{ tail_pos, tail_role?, updated_at? }`。

流错误 `code`：

- `tail_conflict` — CAS 失败

幂等短路（`client_op_id` 已提供时）：

- turn **已完成**（该 user 后已有非空 assistant）→ 直接 `accepted` + `done`
- turn **进行中**（同 `client_op_id` 已占用）→ 直接 `accepted` + `done`，**不 preempt / 不重跑**（避免弱网下在线发送与 outbox flush 并发触发两轮）

客户端：在线 `dispatchSend` 期间对 outbox op 做进程内 claim，flush preflight 跳过已 claim 的条目；`flushOfflineModule` 与全局 sync 共用锁。

## 与离线平台（Stream outbox）

Outbox 布局与 [`shell-sdk/offline-outbox`](../../src/frontend/shell-sdk/offline-outbox.ts) 对齐；Chat flush 走 WS 流式 `message.send`，非通用 Habitat RPC 单次响应。

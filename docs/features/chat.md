# Chat — 离线发送与多端冲突

Chat SPA 支持 **离线写入 outbox**、上线后 **自动重试**，并通过 Hub 侧幂等与 tail CAS 避免重复发送与陈旧消息。

## 客户端

- 发送先入 IndexedDB `outbox`（`moduleId: chat`），并乐观显示 user bubble（`sendStatus: pending`）。
- 离线时可输入并发送；消息排队，Hub 恢复后按 FIFO 重试。
- 重试前调用 `conversation.tail` 对比入队时的 `expected_tail_pos`。
- **tail 不一致**（会话已在别端继续）：标记 `stale`，默认不发送；用户可 **丢弃** 或 **仍要发送**（`force_tail`）。

## Hub 协议

`message.send` 可选字段：

| 字段                | 说明                                 |
| ------------------- | ------------------------------------ |
| `client_op_id`      | 幂等键；重复请求不重复写入 user 消息 |
| `expected_tail_pos` | 发送时观测的 `max(pos)`，空会话为 0  |
| `force_tail`        | 跳过 CAS，追加到当前末尾             |

`conversation.tail` 返回 `{ tail_pos, tail_role?, updated_at? }`。

流错误 `code`：

- `tail_conflict` — CAS 失败
- 幂等已完成时直接 `accepted` + `done`

## 与 Tier 2 离线平台

Outbox 布局与 [`shell-sdk/offline-outbox`](../../src/frontend/shell-sdk/offline-outbox.ts) 对齐；Chat flush 走 WS 流式 `message.send`，非通用 `hub().call` 单次响应。

---
title: 聊天室
---

# 聊天室 — 离线发送与多端冲突

Chat SPA 支持 **离线写入 outbox**、上线后 **自动重试**，并通过 Habitat 侧幂等与 tail CAS
避免重复发送与陈旧消息。

## 用户未读

Chat 维护 **用户已读水位**（`conversation_read_state`，按 Habitat user subject）：

- 会话未读：存在 `role=assistant` 且 `pos > last_read_pos` 的消息。
- `conversation.list` 返回 `unread`；`conversation.unreadCount`
  返回未归档未读会话数（Shell 导航 Chat 角标）。角标计数与列表同范围：可选 `platform`（Chat 传 `chat`）+
  排除已归档。
- **视口已读**：消息列表底部哨兵进入滚动视口且页面可见时才调用
  `conversation.markRead`（水位单调升高）。打开会话或流式结束**不**自动
  markRead；滚离底部或窗口失焦时当前会话可保持未读，Chat 导航数字角标会出现。
- `conversation.subscribeInbox`（WS）在任意会话更新时推送
  `conversation.updated`，供列表与角标刷新；删除 / 归档 / 取消归档也会 poke，以便角标与列表对齐。

用户自己发送的消息不构成未读；不做 agent 未读分区。

## 客户端

- 发送先入 IndexedDB `outbox`（`moduleId: chat`），并乐观显示 user bubble（`sendStatus:
pending`）。
- 离线时可输入并发送；消息排队，Habitat 恢复后按 FIFO 重试。
- **流式生成中**仍可输入并发送：消息入内存队列（不经 Habitat），当前**回合**结束后按 FIFO 自动发出。
- 重试前调用 `conversation.tail` 对比入队时的 `expected_tail_pos`。
- **tail 不一致**（会话已在别端继续）：标记 `stale`，默认不发送；用户可 **丢弃** 或
  **仍要发送**（`force_tail`）。

## Habitat 协议

`message.send` 可选字段：

| 字段                  | 说明                                 |
| --------------------- | ------------------------------------ |
| `client_op_id`        | 幂等键；重复请求不重复写入 user 消息 |
| `expected_tail_pos`   | 发送时观测的 `max(pos)`，空会话为 0  |
| `force_tail`          | 跳过 CAS，追加到当前末尾             |
| `attachment_temp_ids` | 本回合临时附件 id（不入 payload）    |
| `attachments`         | 附件元数据（filename / mime / size） |

## 多模态附件（临时文件）

- 上传：`chat.attachment.upload`（multipart）→ `FREEANIMA_HOME/tmp/chat-attachments/`
- 字节**不**进 object_storage / messages JSONB；payload 只存元数据
- 本回合：图片以 provider 原生 vision parts 注入；后续用户**回合** **不**重传像素
- 无 vision 模型且含图：中文错误提示
- Coding 与 Chat 共用 `ComposeAttachmentStrip` / `ConversationTranscript` 与同一条 `message.send`
- stream 结束后清理临时文件；未消费 temp 有 TTL

`conversation.tail` 返回 `{ tail_pos, tail_role?, updated_at? }`。

流错误 `code`：

- `tail_conflict` — CAS 失败

幂等短路（`client_op_id` 已提供时）：

- **回合已完成**（该 user 后已有非空 assistant）→ 直接 `accepted` + `done`
- **回合进行中**（同 `client_op_id` 已占用）→ 直接 `accepted` + `done`，**不 preempt /
  不重跑**（避免弱网下在线发送与 outbox flush 并发触发两轮）

客户端：在线 `dispatchSend` 期间对 outbox op 做进程内 claim，flush preflight 跳过已 claim
的条目；`flushOfflineModule` 与全局 sync 共用锁。

## 与离线平台（Stream outbox）

Outbox 布局与
[`portal-sdk/offline-outbox`](../../packages/frontend/client/portal-sdk/offline-outbox.ts)
对齐；Chat flush 走 WS 流式 `message.send`，非通用 Habitat RPC 单次响应。

## 朗读

消息操作栏可朗读助手/用户文本。Provider 由 Habitat `tts` 配置（默认 **edge-tts**：Habitat 合成 MP3 +
客户端 `HTMLAudioElement`；可选 **web-speech**：浏览器 `speechSynthesis`）。朗读前经
`markdownToPlainText` 占位过滤（代码块 / 表格 / 链接 / 图片 / 裸 URL），听者保留上下文而不读结构内容本身。

### 自动朗读（顶栏）

聊天页顶栏提供自动朗读开关（非设置页；`localStorage` key `chat:auto-speak` 持久化）：

- **开启后**：仅当前打开会话的流式助手回复按句（`。！？` 与换行）FIFO 入队播放，不必等整条结束。
- **预合成**：播当前句时预取队列下一句的 Edge TTS 音频写入缓存，减轻句间停顿。
- **切会话**：立刻停止并清空队列；切回不补读已错过内容；若流式仍在继续，仅跟读之后新完整句。
- **中途打开总开关**：若该会话仍在流式输出，从当前缓冲文首消费已成句并尽快开读；流已结束则不补读。
- **点停**：流式气泡或对应消息上的喇叭可停止当前播报并清空队列，**不**关闭顶栏总开关；本**回合**不再入队，下一回合回复仍自动读。
- **关闭总开关**：停止播放并清空队列。

### 生命周期

- **保持播放**：切模块、切浏览器 Tab、切到其他 App **不**主动停止；播放状态在 Shell
  级单例（`portal-sdk/speech/speech-playback-service`），Chat SPA unmount 后仍可继续。
- **停止**：用户点停、切换会话、开始播另一条、关闭自动朗读总开关。
- **重进聊天室**：按稳定 key（`conversationId:displayIndex` 或
  `conversationId:stream`）恢复「正在播放」按钮态。

### 移动端 / PWA

- 用户手势链内 `primeMpegSpeechOutput` 解锁 HTMLAudio；移动 WebView 禁用 MSE 播
  MP3，改为缓冲后播放。
- `navigator.mediaSession` 提供系统媒体控件（play/pause/stop）；回前台时若仍在朗读且音频被系统暂停，尝试
  `play()` 恢复。
- **Web Speech** 后台行为依赖浏览器/WebView，不保证切应用后继续；切模块仍不会主动 `cancel`。

## 工具活动条

连续工具调用（同一**工具轮次**，以及中间无助手正文的多个工具轮次）投影为单个 `tool_block`，由 `ToolBlockBubble` 渲染：

- **折叠（默认）：** 一行活动条，标题默认静止截断；headline / 子步骤文案变更时旧行上滚出、新行自下滚入
  - **已完成**调用：显示调用标签（`args._title`，否则工具名）
  - **运行中 / 等待：** 若活跃调用有 live 子步骤（如经 `tool_progress` 的 `subagent_run`），展示**最新子步骤**的 `title`/`name`；否则用调用自身标签
- **一级展开：** 调用列表；每行折叠时用同一折叠摘要规则
- **二级展开：** 每调用的 args / result；`subagent_run` 另显示子 `steps` 摘要（运行中含 live 部分 `result`；子 AutoLlm 运行仍不写入父 `messages`）
- 流式期间，`tool_round_live` 快照 upsert 末尾 `tool_block`，使工具运行时条带更新（`tool_progress` 更新运行中调用的部分 `result`，不标为完成）

---
title: 对话拓扑与消息模型
---

# 对话拓扑与消息模型

谁和谁以什么形状对话：公开时间线与各 Agent 的 LLM 队列如何分工。关联风巢 #18861、总览 #18916、单机 Room #15347。

**本文件只定契约。** 跨实例联邦与 Room 同步见 [`federation.md`](federation.md)（#18917 / #18918）。

## 硬规则

1. **`Room.seq` ≠ 任一 Agent 发给 LLM API 的消息队列。** 同实例内多个 Anima 也各有各的队列。
2. **群聊语义：** 对每个参与 Agent =「我与群内其余人的对话」→ **每 Agent 一条 Conversation**（各自记忆注入、压缩、完整工具轨迹、system / toolsets）。
3. **成员与发言人键 = subject `public_id`**（见 [`habitat-identity.md`](habitat-identity.md)）。成员表**只存** `public_id`；不夹带本机 `entities.id`。
4. **Contact 可选：** 无对应联系人 = **不认识**，不强行建 Contact / shadow subject。有 Contact 再挂显示名与记忆入口；有本机 subject 才能跑该 Agent 的 LLM 队列。
5. **私有钉宿主：** 完整 tool / Self / world / Conversation 不进 Room 公开面（单实例时宿主即本机；跨机见 [`federation.md`](federation.md)）。

## 两轴

| 轴         | 取值                      | 含义                                                                |
| ---------- | ------------------------- | ------------------------------------------------------------------- |
| 参与者范围 | 单实例 / 多实例           | 单实例由本文件；多实例 Room 同步见 [`federation.md`](federation.md) |
| 会话形状   | 私聊（1:1）/ 群聊（N 方） | 私聊仅用户↔Anima；多 Anima 互聊一律走 Room                          |

## 拓扑

### A — 用户 ↔ 指定 Anima（私聊）

| 项   | 结论                                                          |
| ---- | ------------------------------------------------------------- |
| 载体 | 一条 Conversation（公开转录与 LLM 队列合一；今日主路径）      |
| 成员 | 全局唯一 `user` + 一个 `agent`                                |
| 绑定 | `conversations.agent_subject_id` = 该 Anima                   |
| 发言 | `messages.subject_id`：user → user；assistant/tool → 该 agent |
| 延伸 | 创建时可显式选 `agent_subject_id`（缺省 boot agent）          |

### 不支持 — Anima ↔ Anima 私聊

**不做**「两条 agent、一条 Conversation」的 1:1 私聊。多 Anima 对话一律建 **Room**（可仅含 agent 成员；人类可选进房）。实现落点见下节群聊与 #15347。

### C — 群聊（Room）

| 项               | 结论                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 公开时间线       | **Room**：元数据、成员 `public_id[]`、公开消息 + 单调 `seq`                                                                                                                                                                    |
| LLM 队列         | **每本机 agent 成员一条 Conversation**，绑定同一 `room_id`                                                                                                                                                                     |
| 例：用户 + A + B | 1 Room + Conversation_A + Conversation_B                                                                                                                                                                                       |
| 例：仅 A + B     | 1 Room + Conversation_A + Conversation_B（无人类成员亦可）                                                                                                                                                                     |
| UI               | 读 Room；公开气泡用 `speaker_display_name`；未知 `public_id` 弱展示；完整群聊交互见 #15347                                                                                                                                     |
| 内心情景         | 本机 agent 席 `scenario=room_inner`（与 `digital_human` / `coding_agent` 并列；`platform` 仍为 `chat`）                                                                                                                        |
| 投影             | 持令牌时把 Room 公开史**增量物化**进该 Agent Conversation；他人句为 `role=user` + `<room_utterance speaker public_id>` 正文（系统提示含 `<room_members>` 花名册 + 协议说明；用 `public_id` 联查；不以 `user.name` 为唯一身份） |
| 回写             | 仅最终公开回复（+可选工具摘要）进 Room；完整 tool 细节只留在该 Conversation                                                                                                                                                    |
| 人类             | 进 Room、可发言；**不**强制衍生 Conversation；本 Habitat 实例仅有一位人类用户（花名册 `kind=user`）                                                                                                                            |
| API              | 独立 `room.*`；勿用 `message.send` 假装群聊                                                                                                                                                                                    |
| 成员             | `rooms.members` 对象数组；内心席 = 本机 agent 的 Conversation（`UNIQUE(room_id, agent_public_id)`）                                                                                                                            |

```text
Room R（公开 seq；speaker = public_id）
  ├─ Conversation_A  ← A 的 LLM 发送队列
  └─ Conversation_B  ← B 的 LLM 发送队列
```

跨机联邦 Room（主序在 Hub、catch-up、只读副本）见 [`federation.md`](federation.md)。

## public_id 与 Contact / Subject

| 层                  | 角色                                  |
| ------------------- | ------------------------------------- |
| **`public_id`**     | Room 成员与发言归因的唯一键           |
| **Contact**         | 可选「这是谁」；无则不认识            |
| **Subject + World** | 仅本机寄居行动者；才有 LLM 队列与工具 |

深链 `anima:{entities.id}?habitat_instance_id=`（见 identity 文档）用于打开资源，**不是** Room 同步 / 成员主键。

## 单实例 MVP 清单

| 能力 | 最小集                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| Room | 元数据、成员 `public_id[]`、公开消息 + `seq`                                                                               |
| 衍生 | 每个本机 agent 成员 → 一条绑定 `room_id` 的 Conversation                                                                   |
| 投影 | 持令牌时 Room 公开史 → `<room_utterance>` 投影进该 Conversation；系统提示 `<room_members>` 花名册按 `public_id` 联查 → LLM |
| 回写 | 仅公开气泡进 Room                                                                                                          |
| UI   | 未知 `public_id` 弱展示                                                                                                    |

实现落点：#15347（单机 Room + 席位衍生）。私聊选 agent 见拓扑 A。

## 以后再说

- 加密
- 加入 / 邀请 / 授信细化
- 跨机 `public_id` 碰撞策略

跨机已落地语义（公开面副本、Conversation / tool / Self / world **钉宿主**、异机成员不在本机物化 subject/world）见 [`federation.md`](federation.md)。

## 与相邻任务

| 任务            | 边界                                            |
| --------------- | ----------------------------------------------- |
| #15349          | 第二 Anima 能否存在                             |
| #15347          | 单机 Room + 每 Agent Conversation 衍生 / 令牌等 |
| #18917 / #18918 | 联邦；本文件不展开                              |
| #14608          | Agent Team 策略，非消息模型（后置）             |

## 推进切片

1. ~~A′：`conversation.create` 可选 `agent_subject_id`~~
2. ~~#15349 / #48 → 多 agent 实体~~
3. ~~#15347 → 单机群聊 C~~（Anima↔Anima **不**做私聊，改走 Room）
4. ~~#18917 → #18918 → 跨机~~（见 [`federation.md`](federation.md)）
5. #14608 Agent Team（后置；本次不做）

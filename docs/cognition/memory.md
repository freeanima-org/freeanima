---
title: 记忆体系
---

# 记忆体系

> 程序侧统一门面：**MemoryService**（`retain` / `recall` / `reflect` / `syncTurn` …）。
> 受 [Hindsight](https://arxiv.org/abs/2512.12818) 的 retain·recall·reflect 启发；部署取 Mem0 式薄 API（`memory.deployment: embedded | remote` 同契约）；分层加载预算参考 OpenViking 直觉。
> **不做** Hermes 式多 Provider 插件市场；**不做**跨类型统一 RRF。
> Self（「我是谁」）平行于 Memory（「我记得什么」）——见 [`self-layer.md`](self-layer.md)。

## 迁移期双轨（重要）

| 轨                             | 状态                                                                                                  | 说明                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **MemoryService**              | 生产巩固主路径（retain/reflect + syncTurn）                                                           | 见本页与 [`sleep.md`](sleep.md)（已废止旧睡眠） |
| **memory-maintenance**         | 夜间顺序维护（cleanup / Retain 缺口检查 / 周一 **cluster 校准**→reflect·self / temporal）；补跑仅手动 | RPC `memoryMaintenance.*`                       |
| **limbic / dream / narrative** | **存量只读**；写入已拆除                                                                              | 列表与 search 保留                              |

### 多 Anima 作用域

对话路径（系统提示常驻/时间摘要、旁注被动召回/通知/peer 时间线、`memory_semantic_*`）一律绑定会话 `agent_subject_id` 的私有 World；工具不得传 subject/world。夜间 retain / reflect / temporal / cluster 按 enabled agent 分桶，禁止跨 Anima 混巩固。卧室管理面继续显式传 `agent_subject_id`。

---

## 一、Taxonomy（定稿）

```text
Memory
├── Semantic          — 跨时间的「认识库存」（可更新、可合并）
├── Temporal          — 时间桶编年（day/month/year）；自传体客观时间骨架（进 MemoryService）
├── Episodic slim     — 对话切片（syncTurn；embedded=view / standalone 可有表）
├── Episodic raw      — Habitat messages（产品归档；记忆运行时不依赖）
└── Parked            — limbic / dream / narrative autobiography（停写，存量只读）
```

- **Self** 不承载于 semantic；retain/reflect 可选 `identity?` 透镜。
- 语义：**客观为骨架**，主观用 kind 显式标注（`world` / `observation` / `procedural` 主力；`opinion` / `preference` / `experience` 打标）。
- Temporal **是记忆**（时间骨架），不是旁路运维摘要——实现见 [`temporal-summary.md`](temporal-summary.md)（升格中）。
- 召回按 scope：`semantic` | `temporal`；禁止跨类型统一 RRF。

---

## 二、MemoryService 契约

实现：`@freeanima/habitat/capabilities/memory` → `createEmbeddedMemoryService`（及日后 remote client）。

| 方法                                                                   | 角色                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `syncTurn`                                                             | 回合入口：切片 + **内建 cite** + 触发 retain（回合后异步；按 watermark 批量，非每条消息一次 LLM）                                                                                                                                                                     |
| `retain`                                                               | **抽取 + 防重复轻对照**（非整表整理）。素材为 user/assistant **正文**；对照集为本对话策展 related（近期 3 ∪ 今日会话内语义 ≤5 → 时间倒序取 5）+ 跨会话 hybrid（**更高**阈值）；create/update 为主；全量合并归 `reflect`。AutoLlm 调 `memory_semantic_*`，约 20 字收尾 |
| `recall` / `search`                                                    | 委托 SearchBackend hybrid；scope 分召回                                                                                                                                                                                                                               |
| `reflect`                                                              | **巩固作业**（按 `search_documents.cluster_id` 分批；每批并入跨族近邻后单轮有序巩固；**不**按关联对话全量喂料）                                                                                                                                                       |
| `remember` / `update` / `deprecate` / `get` / `list` / `pin` / `unpin` | CRUD                                                                                                                                                                                                                                                                  |
| `cite`                                                                 | 热度（主路径在 syncTurn；显式 API 备用）                                                                                                                                                                                                                              |
| `listResident` / `assembleResidentBlock`                               | 常驻系统提示                                                                                                                                                                                                                                                          |
| `temporal.*`                                                           | list / get / 可选 search / regenerate                                                                                                                                                                                                                                 |

配置：`memory.deployment`（默认 `embedded`）。

「可插拔」= **同契约两种部署**，不是多后端插件。

### Provenance 与 links（真源）

每条 semantic 强制：

```ts
source: { conversation_id, message_id_from?, message_id_to?, message_ids? }
links: Array<{ type: "merged_from"|"supersedes"|"conflicts_with"|"derived_from"; memory_id: number }>
```

缺 provenance 的 retain 写入不合格。迁移期旧字段 `source_conversations` 映射为最小 `source`。

### 存储（embedded）

| 表                      | 角色                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `entities`              | semantic / temporal；`reference_count`                                                       |
| `search_documents`      | 可重建索引；**embedding + cluster_id**（HDBSCAN 向量簇，供 reflect 分批；簇 title 在 Redis） |
| ~~memory_references~~   | **已删除**；cite 在 syncTurn / append 路径 bump `entities.reference_count`                   |
| ~~memory_episodes~~     | embedded **不建**；EpisodeSource = messages view                                             |
| ~~memory_retain_queue~~ | **不建**；watermark（可从 provenance 重建）                                                  |

### 依赖边界

硬依赖：PG、SearchBackend、LLM EnginePort。  
可选：Redis、identity 透镜。  
不依赖：Habitat UI、retain/reflect（切流后）、limbic/dream 写入、Self 写入。

最小可测：`MemoryService + PG + SearchBackend + LLM`（±Redis）。

---

## 三、时间三阶段（认知）

```text
External input / message stream
        │
        ▼
① Instant ─── 单次推理内部激活（不持久化）
        │
        ▼
② Working ─── 上下文窗口（系统提示含 Self + 常驻 + 召回）
        │  syncTurn → retain（异步）/ reflect（巩固）
        ▼
③ Long-term ─── Semantic + Temporal（+ parked 存量）
```

---

## 四、检索（现行 + 目标）

### 分范围主动检索（无统一 recall 工具）

LLM **没有** `memory_recall` 跨类型工具。程序侧 `MemoryService.recall({ scope })` 委托 SearchBackend。

| 范围               | 现行工具 / 路径          | 目标                                    |
| ------------------ | ------------------------ | --------------------------------------- |
| `semantic`         | `memory_semantic_search` | `MemoryService.recall/search`           |
| `temporal`         | 运维 RPC / temporal 实体 | `MemoryService.temporal` + recall scope |
| limbic / narrative | 只读 search/list         | **写入工具已下线**                      |

### 被动语义召回

面向用户回合前注入语义命中（`passive_memory_context`）。配置：`passive_recall` / `memory.passive_recall`。细节与 jieba/vector boost 行为见历史实现；索引旁表 `search_documents`。

默认 **排除常驻**（`exclude_resident`）与 **本会话来源**（`exclude_current_conversation`：`source_conversations` 含当前会话则不注入），避免与对话 raw/slim 原文重复占窗口。

### retain 热路径（抽取 + 防重复）

- **时机**：`syncTurn` 后异步；watermark 切片批量；夜间不自动补跑。
- **本对话 related**：近期 `updated_at` 前 3 ∪ 今日（CST）会话内 hybrid（略低阈值）最多 5 → merge 去重 → 时间倒序取 5（稀疏允许 3+1 / 2+1 等）。
- **跨会话语义相关**：同 hybrid，按本回合各条 user/assistant 分侧配额；**更高** `min_score` / `min_relative_score`（不改 Working 被动默认）。
- 环内不再调用 `memory_semantic_search`。整理字段清单为 `<memory id type sources observed occurred>`。
- 对话素材 `source_data` 为 `<message role t>`：`role` 区分 user/assistant（风巢 #18799），`t` 为消息发送时间。

### 常驻记忆

置顶 + 高引用。Working 注入为 `<memory id>`（置顶加 `pinned="true"`）；装配走 `assembleResidentBlock`（迁移期 `system-prompt.ts` 仍可直接 listResident）。条数 / 置顶上限：`memory.resident.top_n` / `pinned_max`（默认 20 / 20）；cite 权重窗口：`memory.reference.*`。详见 [`context-management.md`](context-management.md)。

### 引用

格式固定 **`[[anima:id]]`**（本地实体引用）。`cite` 在 syncTurn / appendMessage 路径解析并 bump `entities.reference_count`（无 `memory_references` 边表）。  
**不做** `memory:{provider}/{id}` 新规范；多提供商若未来出现再议。

---

## 五、与主流管线对照

| 来源       | 采用                                  | 不采用                   |
| ---------- | ------------------------------------- | ------------------------ |
| Hindsight  | retain / recall / reflect；fact kinds | 云服务；本阶段全量 graph |
| Mem0       | 薄 API、异步抽取、可独立部署          | 万能 vector SaaS 心智    |
| OpenViking | 分层加载预算（resident/recall）       | `viking://` 整套协议     |
| Hermes     | 嵌入 vs 外置部署直觉                  | 灵活 Provider ABC        |

Letta / LangChain / LlamaIndex 与 Working 上下文策略对照见 [`context-management.md`](context-management.md)。

感性（limbic）/ 梦境 / 叙事：**存量只读**，写入路径与 sleep.dream 步已拆除。

---

## 六、实现分期

1. Spec + MemoryService 外壳（本页 + `createEmbeddedMemoryService`）
2. retain（热路径 `syncTurn`）
3. reflect + temporal；limbic/dream/narrative **写入拆除**（存量只读）
4. MCP / embedded|remote / standalone harness
5. 删 `memory_references`；cite 收尾；文档与门禁

评测挂载（LoCoMo 等）见风巢 #16041；本体系只保证契约可接「灌对话 → 检索」。
薄 Eval Adapter：[`scripts/eval/locomo/README.md`](../../scripts/eval/locomo/README.md)（compose PG+Redis + hybrid FTS；`--dry-run --fixture` 冒烟；全量 opt-in，不进 CI）。不写用户 `~/.anima/config.yaml`。

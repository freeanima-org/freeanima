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

| 方法                                                                   | 角色                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `syncTurn`                                                             | 回合入口：切片 + **内建 cite** + 触发 retain              |
| `retain`                                                               | 可重放抽取；默认 user/assistant 正文；无思考链/工具       |
| `recall` / `search`                                                    | 委托 SearchBackend hybrid；scope 分召回                   |
| `reflect`                                                              | **巩固作业**（按 `search_documents.cluster_id` 分批四轮） |
| `remember` / `update` / `deprecate` / `get` / `list` / `pin` / `unpin` | CRUD                                                      |
| `cite`                                                                 | 热度（主路径在 syncTurn；显式 API 备用）                  |
| `listResident` / `assembleResidentBlock`                               | 常驻系统提示                                              |
| `temporal.*`                                                           | list / get / 可选 search / regenerate                     |

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

| 表                      | 角色                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| `entities`              | semantic / temporal；`reference_count`                                     |
| `search_documents`      | 可重建索引；**embedding + cluster_id**（向量簇，供 reflect 分批）          |
| ~~memory_references~~   | **已删除**；cite 在 syncTurn / append 路径 bump `entities.reference_count` |
| ~~memory_episodes~~     | embedded **不建**；EpisodeSource = messages view                           |
| ~~memory_retain_queue~~ | **不建**；watermark（可从 provenance 重建）                                |

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

面向用户回合前注入语义命中（`passive_memory_context`）。配置：`memory.passive_recall`。细节与 jieba/vector boost 行为见历史实现；索引旁表 `search_documents`。

### 常驻记忆

置顶 + 高引用；标记 `[[anima:id]]`。装配目标走 `assembleResidentBlock`（迁移期 `system-prompt.ts` 仍可直接 listResident）。条数 / 置顶上限：`memory.resident.top_n` / `pinned_max`（默认 20 / 40）；cite 权重窗口：`memory.reference.*`。详见 [`context-management.md`](context-management.md)。

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

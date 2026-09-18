---
title: Harness 集成方向调研
status: 调研（未决策 / 不实施）
date: 2026-09-18
---

# Harness 集成方向调研：与 DeepSeek Harness / pi 的关系重定位

> **本文是方向性调研，不是设计定稿，也不构成实施承诺。**
> 目的：把"是否把 agent 层交给外部 harness"这件事的**方案空间、证据与取舍**固定下来，供以后判断。
> 证据来源：本仓代码实测、DeepSeek Harness（DSH）源码 checkout（本次调研时的本地路径 `/home/grass/workspace/forks/deepseek-harness`，版本 `0.1.6-alpha.2`，MIT），以及 pi 公开文档（第三方镜像站，非官方）。

## 0. 摘要

1. **真正的问题不是"要不要用别人的 agent 框架"，而是"谁当宿主"。** 候选拓扑只有三种：FreeAnima 当宿主（harness 当库）、harness 当宿主（FreeAnima 当插件）、双方对等互通。
2. **痛点定位决定了收益大小。** 若痛在"记忆/自我层的调优"，换宿主几乎无效——DSH 与 pi **都没有记忆子系统**。若痛在"压缩/会话/coding 工作台"，那正是 harness 的主场。
3. **本轮讨论中，痛点被确认为后者**（压缩触发不准 + 编码工作台整体不如直接用 Claude Code/Cursor）。结论随之翻转：整合的性质从"省维护费"变成"买你造不好的能力"。
4. **其中"压缩触发不准"经代码核对是可以在本仓原地修好的计量缺陷，不需要换宿主**（见 §3.3）。这一条应作为独立工作项，且是任何迁移决策的前置基线与对照实验。
5. **推荐方向（讨论中收敛，未正式决策）**：把产品拆成三个概念——**A agent harness / B 个人数据管理系统 / C 数字生命运行时**；**淘汰 A**，B 保留为独立 App（去 chat），C 做成 DSH 插件，B↔C 通过 RPC hub 通信。
6. **关键结构性约束**：C 依赖 A 的方式不是"调用 A 的功能"，而是**拥有 A 的会话原料**。因此"A 的 UI 可以死，A 的会话数据模型必须活"。
7. **最大风险**：DSH 公开 API 明确为 pre-stable；且其会话日志会被外发给模型服务商，任何进入工具输出的秘密都会被永久化并可能外流。

## 1. 触发问题

自研一个以 agent 为核心的运行时，**写代码不是瓶颈，调优与决策是瓶颈**。具体表现为：

- 商品化的 agent 管道（循环、工具协议、压缩、会话、模型接入、对话 UI）维护量大，且长期落后于专用 harness；
- 与此同时，真正差异化的东西（记忆、自我层、四层认知、凭证、数据主权）**没有任何现成生态可以借**，只能自研；
- 结果是"广度"与"深度"同时压在一个 13 包的 monorepo 上。

## 2. 成本结构实测

`packages/` 共 13 个包，约 **33.9 万行 TS/TSX**（排除 `node_modules` / `dist`）；全仓（含 `src/`、`tests/`）**3372 个文件**。

| 区域                                                                  |   行数 | 性质                         |
| --------------------------------------------------------------------- | -----: | ---------------------------- |
| `ui-features/`（24 个 UI 特性）                                       | 80,845 | 成本中心；一半业务、一半商品 |
| `core/db`（统一 `entities` + 迁移）                                   | 25,730 | **数据主权 → 留**            |
| `capabilities/memory`                                                 | 13,091 | **差异化 → 留**              |
| `capabilities/self`                                                   |  1,255 | **差异化 → 留**              |
| `core/{llm,tool,compress,tokenizer,skill,hooks,provider}`             | 15,765 | 商品化 → 可换                |
| `engine`（回合/循环/goal/pipeline）                                   |  6,776 | 商品化 → 可换                |
| `capabilities/{tools,connectors,outpost,mcp-client,ports,llm-openai}` | 28,901 | 商品化（部分留）             |
| `features/`（26 路由特性 + 2 工具特性）                               | 51,032 | 业务 + 商品混合              |
| `{portal-sdk,ui-kit,app-frame,portal}`                                | 46,727 | 前端底座                     |
| `shared`（契约 + `pg-shapes` codegen）                                | 27,600 | 底座                         |
| `{server,cli}` 组合根                                                 | 22,543 | 底座                         |

`capabilities/connectors` 实测拆分：`gateway` 5,964 / `vault` 2,129 / `cron` 2,068。

**粗判**：商品化 agent 管道约 **6~9 万行服务端 + 3 万行 UI**；差异化（记忆+自我+实体）约 **4 万行**；业务广度约 25%；前端底座约 14%。
→ 换宿主最多消灭商品化那部分的一部分，且需先付出重写代价。**它不解决"决策太多"——决策密度来自广度**（26 个特性 ×（domain + habitat RPC + UI + i18n + docs + 测试））。

## 3. 痛点定位

### 3.1 已确认的痛点

| 痛点              | 具体形态                                                                          | 性质                         |
| ----------------- | --------------------------------------------------------------------------------- | ---------------------------- |
| **压缩**          | 触发不准：该压不压、不该压乱压                                                    | **本仓 bug**，非领域难题     |
| **coding 工作台** | 工具不够（缺 LSP/终端）、UX 不好、脑手分离夹生、整体不如直接用 Claude Code/Cursor | **领域军备竞赛，已明确落后** |
| **会话**          | 未确认是否真痛（"搜不到/追不了/导不出/崩了就丢"未被选中）                         | 待确认                       |

### 3.2 差距对照（压缩）

|        | FreeAnima                                                                                           | DSH                                                        |
| ------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 模型   | 四段视图 system/summary/slim/raw，不删消息，PG 全量，异步摘要（`../docs/cognition/compression.md`） | 压缩契约 + 自动压缩 + 工具结果预剪 + 图片卸载 + `/compact` |
| 大输出 | 落 `~/.anima/tool-artifacts/` + `artifact_path` 再取                                                | `spill` + `spill-policy`（**对等物已有**）                 |

### 3.3 「触发不准」的根因（实测，可在原地修复）

压缩触发精度由三个估算相乘决定，三处都有缺陷：

1. **`ContextWindowSource` 只有一个取值 `"catalog"`。** `packages/core/config/compression-config.ts` 的 `resolveContextWindowWithSource`：catalog 有值 → token 模式；**否则 `window = null` → 整个 token 模式失效，退回消息数模式（`max_message_pairs: 50`）**。使用自定义 OpenAI 兼容端点 / 自建服务 / 目录查不到的模型时，压缩根本不按 token 触发。
2. **触发用三重估算，且工具 schema 全量参与。** `packages/core/compress/compressor.ts:250-252`：`estimateTokens(system) + estimateMessagesTokens(body) + estimateToolsTokens(JSON.stringify(tools))`，工具 schema 的 JSON 被当普通文本估算，通常系统性高估 → 提前压缩。
3. **权威数据已入库却未被使用。** `packages/engine/loop-mechanism/loop-engine.ts:428` 取到 `chunk.usage`，写入 assistant 消息；`packages/shared/pg-shapes/jsonb/message-payload.ts:78` 是持久化字段（`assistantPayloadSchema.usage`）。而压缩器接收的正是 `runtimeBody: StoredMessage[]`——**拿得到每条消息的 `usage`，但触发计算一次都没用**。

**修法（不动数据模型）**

1. `ContextWindowSource` 增加 `"configured"`，允许在 connection / `text_generate` 段声明 `context_window`，取消"目录 miss → 消息数模式"的悬崖；
2. 触发计数改为 replay-aware：取最近一条带 `usage` 的 assistant 的 `prompt_tokens`，加上其后新增消息的估算；无 `usage` 时才退回全量估算；
3. 按 model 记录 `usage / estimate` 比值做自适应校准，并把 `context_tokens_est / usage / window / source` 摊到压缩诊断（`CompressionAnalysis` 已有 `context_window_source` 字段，方向一致）。

> 这一项的独立性很重要：**它是所有"迁移到外部 harness"论证的前置对照实验。** 修完若痛点消失，则"为压缩而迁移"的理由不成立。

## 4. 概念拆分：A / B / C

| 概念                  | 核心资产                                                       | 商品化程度         | 谁在做                       | FreeAnima 现状             |
| --------------------- | -------------------------------------------------------------- | ------------------ | ---------------------------- | -------------------------- |
| **A. Agent harness**  | 循环、工具协议、会话、压缩、模型接入、coding 工具链、审批/沙箱 | 高度商品化且已卷深 | DSH、pi、Claude Code、Cursor | 自研，且明显落后           |
| **B. 个人数据管理**   | 实体模型、任务/笔记/日历/日记/邮件/凭证                        | 高度拥挤           | Obsidian/Notion/1Password…   | 自研，`core/db` 是最大单包 |
| **C. 数字生命运行时** | A 的会话原料 → 记忆 → 自我层 → 反注入 A 的上下文               | 无人在做           | 只有本仓                     | 自研（memory + self）      |

**关键结构性观察**

> **C 对 A 的依赖不是"调用 A 的功能"，而是"拥有 A 的会话原料"。**
>
> - C 的**输入**是原始对话（`retain` 按用户回合触发）；
> - C 的**输出**是系统提示段（自我层 / 常驻记忆 / 时间摘要 / 被动召回）；
> - 两端都长在 A 的会话与上下文接口上。

推论：**"买 A"的代价是切断 C 的动脉。** 只要会话 SSOT 不在自己手里，C 就从"运行时"退化成"某个 harness 的插件"。

**另一条推论**：**A 的 UI 可以死，A 的会话数据模型必须活。** 杀掉 chat 之后，`conversations` + `messages` 要作为归档/摄取管道留在 B，否则 retain 无输入、记忆引用（`[[anima:id]]` → `<memory id>`）断链、卧室历史与时间摘要失效。

## 5. 双方能力与接缝盘点

### 5.1 FreeAnima 已有的缝（比预期多）

| 缝                                     | 位置                                                                                                                                                                                                     | 状态                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **`MemoryService` 双部署**             | `packages/capabilities/memory/service/types.ts`：`MemoryDeployment = "embedded" \| "remote"`                                                                                                             | **已设计**                                                                         |
| **remote MemoryService = HTTP 客户端** | `packages/capabilities/memory/service/remote.ts`（104 行，完整实现）                                                                                                                                     | **已实现**，指向 `/rpc/v1/memory/<method>`；仅 `temporal.search` 抛 NotImplemented |
| **B 暴露这些路由**                     | 全仓只有 `createEmbeddedMemoryService`（`packages/server/service/memory-sync-turn.ts:52`）                                                                                                               | **未做**（代码注释自述"未部署时方法会失败"）                                       |
| **retain/reflect 的 LLM 端口**         | `service/retain-llm-port.ts` / `reflect-llm-port.ts`；今天由 `packages/server/service/memory-engines.ts:266-267` 注册                                                                                    | 端口形状天然支持替换                                                               |
| **vault RPC 方法面**                   | `packages/features/vault/habitat/routes/index.ts`：`vault.list/get/create/patch/touch/delete/search/history.list/history.restore/crypto.get/init/change`                                                 | 已存在                                                                             |
| **vault 安全模型**                     | `packages/shared/rpc-contract/frames/vault.ts`：User 库（服务端仅密文，客户端主密码解）/ Agent 库（Habitat 可解）；per-item `dek_wrapped`；`uris` + `match`（domain/host/starts_with/exact/regex/never） | 已存在，可直接复用                                                                 |
| **Service API Token 授权形状**         | `authorization.data: DataCapabilityFragment`（component/world/access）                                                                                                                                   | 已存在                                                                             |
| **记忆工具**                           | `memory_remember`、`memory_semantic_{create,update,deprecate,merge,search}`、`memory_service_{get,list,recall}`、`self_get_blocks`、`self_update_block`、`conversation_search`                           | 已存在（`capabilities/memory/register-tools.ts` 等）                               |
| **系统提示段**                         | `capabilities/memory/system-prompt-sections.ts`：段 id `self` / `memory-citation` / `memory-recall` / `resident` / `agents`                                                                              | 领域设计，可保留语义、更换承载                                                     |

> **结论：B/C 拆分的契约已经写好一半（C 侧客户端），缺的是 B 侧路由；而且这个契约是 HTTP 的，"数据通过 RPC hub 通信"不是新造，是补齐半成品。**

### 5.2 DSH 的接缝（四类全在，且都是插件原生）

| 机制                        | API                                                                                                             | 证据（checkout 内路径）                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **上下文**                  | `ctx.on('agent/pre-step', …)` + `ctx.sessionProjections.register({…})`（注入并记账，避免每步重复）              | `packages/context/time-context/src/index.ts` —— 这就是"把记忆/自我层注入 DSH 上下文"的参考模板 |
| **tools**                   | `ctx.tools.register(defineTool({ … }))`                                                                         | `packages/shell/tool-bash/src/index.ts` 等                                                     |
| **命令**                    | `ctx.commands.register({ … })`                                                                                  | `packages/compaction/command-compact/src/index.ts`、`packages/goal/command-goal/src/index.ts`  |
| **回合事件（retain 触发）** | 会话事件 `turn/start` / `turn/end` / `agent/turn-stopping`，类型 `SessionEvent<'turn/end'>`                     | `packages/core/agent/src/consumed-work.ts`                                                     |
| **凭证**                    | `ctx.credentials`：`credentialRef(name)` / `resolve` / `describe` / `set` / `unset` + records（`<owner>/<id>`） | `packages/credentials/credentials/README.md`                                                   |
| **插件分发**                | `dsh.bundle.patch` + profile 的 `dsh.profile.bundles`，`dsh plugin add` 安装                                    | `docs/user/develop/basic/publish.md`                                                           |
| **客户端 UI**               | 侧栏入口 + 主面板：`MainPanelId` / `sidebar.panellist`；React 18 由宿主经 `window.__ModuleLoader__` 注入        | `packages/client/ui-plugin-manager/src/client/index.ts`、`packages/client/web/src/platform.ts` |

**DSH 相对本仓的商品化能力**（可直接获得）：compaction 家族（`compaction` / `compaction-basic` / `compaction-tool-result-pruner` / `compaction-image-offload` / `command-compact`）；session data plane（JSONL 代际格式 + 相邻迁移 v0→v3 + checkpoint policy + 投影与缓存 + turn outline + stats + 标题 + telemetry）；session-query（`session_search` / `trace` / `event_read` / `event_search` / `event_trace` + SQLite + ZIP 导出）；coding 工具链（`bash`/`bash-persistent`/`pwsh`、持久终端六件套、`fs`(edit/read/read_image/write)、`glob`/`grep`、`str_replace_editor`、**`lsp`**、`subagent`(+control)、`jobs`、`plan`、`todo`、`schedule`、`goal`、`run_code`(PTC)、`sandbox`、`spill`、deliverables、`workflow`、`mcp`+`mcp-resources`、`web`/`web-fetch`、browser-use/computer-use）；`token-meter`（replay-aware、确定性、复用 provider 上报用量）。

### 5.3 硬约束（会决定成败）

1. **Cordis 同源但不兼容。** 本仓 `cordis@4.0.0-rc.10`；DSH 把 Cordis 源码内置改名 `@deepseek-ai/cordis`（发布 `4.0.2`，上游 rc.7 + 本地补丁）。两边都假设"进程只有一个根 Context"（本仓见 `../packages/kernel/context.ts`）。
   → **可以把本仓领域模块改写成 DSH 插件；不能让两个内核同进程共存。**
2. **DSH 是 pre-stable。** `AGENTS.md` 明写 "Public APIs are pre-stable; update every consumer"；版本 `0.1.6-alpha.2`。
3. **宿主插件在进程内、沙箱之外运行。** DSH plugin-manager 文档明述 "installed Host code executes in-process outside the workspace sandbox"，且 `credentials-local` 文档自认 "agent tool processes run as that same user, so **this store cannot isolate secrets from the agent**"。
4. **会话日志会外发。** `packages/session/session-log-deepseek` 把 canonical session log 作为请求字段 `dsh_session_log` 上传给官方 API。
   → **任何进入工具输出的内容都可能被永久化并外发。**
5. **UI 体量与版本。** `ui-features` 80.8k 行；DSH 客户端是 React **18** 且 `react`/`react-dom` 由宿主注入；本仓钉 React **19.2.8**。
   → 原生插槽化 = 降级 + 设计系统替换 + 插槽化改造（月级）；iframe/路由共存 = 天级但与宿主割裂。

### 5.4 pi 的定位（对比参考）

pi（`earendil-works/pi`，前身 `badlogic/pi-mono`）是**库式工具集**：`@mariozechner/pi-agent-core`（`Agent` 循环）、`pi-ai`（provider 抽象）、`@mariozechner/pi-coding-agent`（`createAgentSession` / `AgentSession` / `SessionManager` / compaction / extension API）、`pi-tui`。

- **可进程内 new 出来**（无 Cordis 冲突），extension API 覆盖 hooks、`registerTool`、`registerCommand`、context manipulation、compaction hooks、自定义 provider。
- **不提供**：coding 工具链（bash/read/edit/write 很薄，无 LSP）、会话服务（trace/query/export）、插件市场与 Web UI 面板。
- **注意**：DSH 已有 `packages/llm/llm-pi-ai`（`@deepseek-ai/dsh-llm-pi-ai`），即 **DSH 已把 pi 的 provider 目录与 OAuth 接成适配器**。选 DSH 即可同时获得 pi 的模型生态；pi 作为独立生态的价值在下降。
- 公开文档多来自第三方镜像站（`mintlify.wiki/pt-act/pi-mono`），包 scope 为 `@mariozechner`，与上游仓库/scope 存在分叉，**引用时需注明非官方**。

**结论**：pi 对"压缩/会话/coding"三块痛**收益最小**，它解决的是"少维护一个循环"，不适合作主路线。

## 6. 方案空间

按"谁当宿主"分三种拓扑，本仓此前的三个想法（拆出 agent 核心 / SDK 集成 / 做成插件）都是它们的变体：

| 拓扑                                | 形态                                        | 保住                           | 放弃                               | 三块痛能解决吗                                           |
| ----------------------------------- | ------------------------------------------- | ------------------------------ | ---------------------------------- | -------------------------------------------------------- |
| **I. 本仓当宿主，harness 当库**     | pi 库式替换 loop；或 DSH SDK 仅作推理服务   | 会话主权、记忆/自我、B、自有壳 | A 的实现（只租到 loose 部分）      | **否**——DSH 的压缩/会话/coding 全绑在它自己的 session 上 |
| **II. 保 B+C，A 走人**              | 编码工作台从产品线摘出，日常用外部工具      | B、C、自有壳                   | A 作为产品线                       | coding ✅；压缩/会话 ❌                                  |
| **III. harness 当宿主，C 做成插件** | 本仓成为 DSH bundle                         | 记忆/自我/数据/壳              | 会话主权、宿主内安全模型、上游节奏 | **三块全 ✅**，也是唯一要求放弃"独立平台"的路            |
| **IV. 不集成**                      | 同机并用（今天就用 DSH/Claude Code 干编码） | 全部                           | 无                                 | coding ✅，且提供**真实基线**                            |

**被否掉的方案（记录理由）**

| 方案                                 | 否决理由                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 把 DSH 当库挂进本仓 kernel           | 两个 Cordis 根 Context，实践不可行（约束 1）                                                                                           |
| 把秘密整体迁入 `credentials-local`   | `set` 即明文落盘；DSH 自认该 store 无法与 agent 隔离；会丢掉 User 库主密码分层、`uris` 白名单、`dek_wrapped`、Bitwarden 导入（约束 3） |
| Fork DSH / pi 改成"个人数据 harness" | 把"维护一个 App"换成"维护 App + 上游分支"，且分支一深即失去生态兼容                                                                    |
| 为压缩精度迁移会话 SSOT              | 拿最贵的决定换最便宜的痛（见 §3.3）                                                                                                    |

## 7. 推荐方向（讨论中收敛，未正式决策）

**目标形态**

- **A 整体淘汰**，由 DSH 承担，成为唯一对话表面；
- **B = 现在的 App 保留**（Portal 壳 Tauri/web/mobile/MV3 不变），**去掉 chat**，保留个人数据管理、各 agent 私有数据查看、记忆层查看；
- **C = 新项目，做成 DSH 插件**，基于 B，通过 RPC hub 读写数据；记忆的 LLM 调用使用 DSH 的 `ctx.llm`。

```text
┌──────────────────── DSH（宿主 / 唯一对话表面） ────────────────────┐
│  agent loop · compaction · session(JSONL) · tools · sandbox · LSP  │
│  ┌────────── C：dsh-freeanima（bundle，host 半为主） ──────────┐   │
│  │ fa-hub-client     RPC 客户端（hubUrl + token）               │   │
│  │ fa-context        agent/pre-step + sessionProjections 注入   │   │
│  │ fa-memory-tools   ctx.tools.register(...)                   │   │
│  │ fa-turn-ingest    订阅 turn/end → 归档回合                    │   │
│  │ fa-cognition      retain / reflect / passive-recall / 时间摘要│   │
│  │ fa-commands       ctx.commands.register(...)                │   │
│  │ fa-credentials    注册 ctx.credentials provider（后端 B）     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬─────────────────────────────────────┘
                  HTTP RPC hub（Service API Token）
┌──────────────────────────────┴──── B：App（无 chat） ───────────────┐
│  Portal 壳 · 数据模块 · 卧室/记忆查看 · /vault 控制面                │
│  H1 MemStore · H2 TurnArchive · H3 VaultResolve · 现有特性 RPC      │
│  PG：entities · messages/conversations（归档）· vault_item · search  │
└────────────────────────────────────────────────────────────────────┘
```

**讨论中已收敛的方向**（未正式决策，本文仅记录）

| #   | 方向                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ |
| D1  | A 整体淘汰，不保留任何自研循环/压缩/会话运行时                                                   |
| D2  | B、C 拆成两个项目，之间用 HTTP RPC hub                                                           |
| D3  | `MemoryService` 拆成两个契约：`MemStore`（B，无 LLM）+ `CognitionOrchestrator`（C，用 DSH 模型） |
| D4  | Room（多主体群聊拓扑）、Gateway（Discord/微信）、语音助手一并放弃                                |
| D5  | 凭证：C 注册后端为 B 的 `ctx.credentials` provider + `exposure` 分级 + 输出脱敏                  |
| D6  | Portal 壳与数据模块保留，只摘掉 chat 表面                                                        |

**该方向的收益**：同时拿到 ① 壳与数据主权不丢、② A 的全部商品化能力、③ 删掉约 6~9 万行商品化代码。
**该方向的代价**：会话 SSOT 交给 pre-stable 的上游；Room/Gateway/语音三条产品线终止；宿主内安全模型需重新设计。

## 8. 契约设计（草案）

### H1 `MemStore`（B，无 LLM）

从 `MemoryService` 的 18 个方法切出**存储侧**：
`remember` · `update` · `deprecate` · `get` · `list` · `pin` · `unpin` · `cite` · `listResident` · `searchRaw`（FTS + 嵌入，不做重排）· `temporal.list` · `temporal.get` · `temporal.regenerate`

- 路由：`POST /rpc/v1/memstore/*`，JSON，Service API Token 鉴权；
- `service/remote.ts` 拆成 `remote-memstore.ts` 与 `remote-cognition.ts`；
- 保留 `MemoryDeployment = "embedded" | "remote"` 双实现，作为回滚路径。

### H2 `TurnArchive`（B）

- `archive.session.upsert { session_id, title, agent_subject_id }`
- `archive.turn { session_id, agent_subject_id, turn, messages[], workspace_root?, platform: "dsh" }` → 返回稳定 message id
- 复用现有约定：`conversations.platform = "dsh"` + `platform_extra = { session_id, workspace_root }`（对齐 coding 会话的 `platform_extra.outpost_instance_id` 模式，见 `../docs/modules/coding.md`）。
- **message id 稳定性是硬要求**（记忆引用指向归档消息）。

### H3 `VaultResolve`（B）

- 复用 `vault.*` 方法面；新增 `vault.resolveField { item_id, field, purpose, requester }` 与 `vault.describe { item_id }`（仅元数据）；
- `vault_item` 增 `exposure`：`hub-only`（默认）/ `proxyable` / `session-injectable`；
- `proxyable` 复用已有 `uris` + `match` 作为目标白名单；
- 授权叠加：Service API Token 的 `authorization.data` + 条目 `exposure` + `uris` 白名单 + 会话租约。

### C 的对外形态

- 包名 `dsh-freeanima`，声明 `dsh.bundle.patch`，`cordis.patch.yml` 插入上表 7 个 host 行；
- 依赖 DSH 内置的 `@deepseek-ai/cordis`，**不依赖本仓私有包**；契约用从 method defs codegen 出的 JSON/TS 产物（本仓 13 包均不发布，见 `../docs/product/src-layering.md`）；
- 配置项：`hubUrl`、`hubTokenRef`（走 `ctx.credentials`）、`profile → Anima 默认映射`。

## 9. 凭证方案

### 9.1 约束

| 编号 | 事实                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1   | DSH 的会话日志会被持久化，且 `session-log-deepseek` 会把 canonical log 作为请求字段外发                                                                      |
| F2   | DSH 已有 `ctx.credentials`（配置只写名字、运行时解析、本地私有 YAML + 每次运行 env 覆盖 + records）                                                          |
| F3   | 本仓 vault 已内建两层分级：**User 库**（服务端仅密文、客户端主密码解）与 **Agent 库**（Habitat 可解）；条带 `uris` + `match` 白名单与 per-item `dek_wrapped` |
| F4   | 今天值只在 B 进程内被解析（`capabilities/config-refs/resolve.ts`）；工具全在 B 侧执行                                                                        |
| F5   | 新形态引入全新消费者：DSH 原生工具（bash / git / curl / LSP / terminal）                                                                                     |

**不变量重述**（从"LLM 看不到值"升级为）：

> **值永不进入模型可见内容；且永不进入任何会被持久化或外发的载荷。**

### 9.2 方案对比

| 方案                              | 做法                                                                       | 不变量          | DSH 原生工具能用凭据 | 主要代价                                  |
| --------------------------------- | -------------------------------------------------------------------------- | --------------- | -------------------- | ----------------------------------------- |
| **V1 保守**                       | 值只在 B 解析；DSH 要凭据只能调 B 的代理工具                               | ✅              | ❌                   | 体验割裂；`git push` / 私有 registry 需绕 |
| **V2 会话租约注入**               | 显式授权条目注入会话进程环境，单会话 + 限期 + 可撤销 + 审计                | ⚠️ 依赖输出脱敏 | ✅                   | 需覆盖多出口的脱敏组件                    |
| **V3 代理模式**                   | 值不出 B：B 提供 HTTP 代理（按 `uris` 注入 header）+ git credential helper | ✅              | ✅（HTTP/git）       | 要写代理；覆盖不到不走代理的二进制        |
| **V4 分级（推荐）**               | **V1 默认 + V3 覆盖 HTTP/git + V2 作为逐条显式例外**                       | ✅ 默认保持     | ✅ 常用              | 三件各做一点                              |
| **V5 整体迁入 `ctx.credentials`** | 放弃本仓密码库                                                             | ❌              | ✅                   | 主权与安全模型双降级（见 §6 否决理由）    |

### 9.3 推荐组合与理由

**V4 几乎 1:1 复用现有结构**，把"要不要放弃不变量"从**全局决定**降级为**逐条决定**：

| 桶                          | 规则                                             | 复用                      |
| --------------------------- | ------------------------------------------------ | ------------------------- |
| User 库                     | 永不出客户端                                     | 不变                      |
| Agent 库 · 默认             | `hub-only`：B 解析，DSH 永不可见                 | V1                        |
| Agent 库 · 有 `uris` 白名单 | `proxyable`：B 的代理可按 domain/host 代打       | 复用已有 `uris` + `match` |
| Agent 库 · 显式标记         | `session-injectable`：按次解析 + 会话租约 + 审计 | 新增一个字段与一个组件    |

**接口适配另外一层**：C 注册一个**后端是 B 的 `ctx.credentials` provider**（DSH 文档明确允许"Choose a different store"，`credentials-local` 只是默认 provider）——DSH 侧零改造，秘密的 SSOT、审计、User/Agent 分层、`uris` 白名单全部留在 B；**值不落盘**，只在单次 `resolve` 的内存里停留。DSH 的 records 只放**元数据**（有哪些凭据、来源、可写性），值永不进 records。

`/vault` 页（Portal 保留）成为三档 `exposure` 的控制面。

### 9.4 不可省的公共前置：输出脱敏

由于 F1，**即使选择把秘密交给 DSH，"值出现在工具输出里"也依然不可接受**。脱敏必须发生在 tool result 进入会话日志**之前**，并覆盖四个出口：**tool result / spill / 压缩摘要 / telemetry**。

> **这是本议题里唯一无法回避的工程量**，也是 V2/V4/V5 的共同前置。

## 10. 里程碑（草案，未实施）

| 里程碑          | 内容                                                                                                                                                                                            | 验证目标                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **M0 假设切片** | B 暴露 H1 最小路由（`listResident`/`remember`/`searchRaw`）+ H2 最小路由（`archive.turn`）+ C 骨架（`fa-hub-client` / `fa-context` 注入常驻记忆 / `fa-turn-ingest` 归档 / retain 用 `ctx.llm`） | 打掉三条最不确定的假设：hub 契约够用、`agent/pre-step` 能注入且幂等、`turn/end` 归档→retain 闭环 |
| **M1 记忆闭环** | H1 完整 + D3 双契约；retain/reflect/passive-recall/时间摘要全在 C；**压缩触发修复（§3.3）**                                                                                                     | 记忆闭环可用；`text_generate` 从 B 移除后启动不再报缺配置；压缩偏差 <5%                          |
| **M2 凭证层**   | H3 + `exposure` + provider + 输出脱敏                                                                                                                                                           | 泄漏探针在 session log 与 `dsh_session_log` 中查不到明文                                         |
| **M3 拆除 A**   | 删除 A（§11.1 清单）+ Portal 摘 chat；移除 `MemoryDeployment` 回滚路径                                                                                                                          | 护栏仍为空基线；Portal 无 chat 路由残留                                                          |
| **M4 可选**     | DSH client 半：记忆查看面板；B 数据特性包成 DSH tools                                                                                                                                           | —                                                                                                |

## 11. 工作量与风险

### 11.1 删除目标（M3，实测行数）

`engine` 6.8k · `core/{llm,compress,tokenizer,tool,skill,hooks,provider}` 15.8k · `capabilities/{tools, connectors/gateway 5,964, outpost, mcp-client, llm-openai}` · `features/{chat,room,coding,subagent,workflow,content-block,mcp}` ~20k · `ui-features/{chat,coding,room,voice-assistant}` ~20k · `cli/{client,probe}` 的 coding 执行面。

保住：`core/db` 25.7k · `capabilities/memory`（编排迁 C）· `capabilities/self` · `connectors/vault` 2,129 · `connectors/cron` 2,068（后续可用 DSH `schedule` 替代）。
`habitat_runtime_config`：`embedding` 留 B，`text_generate` 移出。

### 11.2 风险与缓解

| 风险                      | 缓解                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| DSH 公开 API pre-stable   | 只用文档化 seam（`ctx.tools` / `ctx.commands` / `agent/pre-step` / `sessionProjections` / `ctx.credentials`）；锁版本；不 fork |
| 秘密进入会话日志并外发    | 输出脱敏为公共前置；`hub-only` 为默认桶                                                                                        |
| 会话被上游拥有            | B 只作归档；H2 保证 message id 稳定；引用完整性测试                                                                            |
| 契约发布（13 包均不发布） | C 不 import 本仓私有包；契约 codegen                                                                                           |
| M3 不可逆                 | M3 前保留 `MemoryDeployment=embedded`，每步可切回                                                                              |
| UI 重做被低估             | 先用 iframe/路由共存；不承诺原生插槽化                                                                                         |

### 11.3 不会失去的东西

Portal 壳（Tauri/web/mobile/MV3）与全部数据模块保留——**该方向不要求放弃自有壳**，这是它相对"整体迁入 DSH"的主要优势。

## 12. 待确认项（不阻塞，实施时必须先核实）

1. `credentialRef` 是否强制 POSIX 标识符（只影响 ref 映射表的形态；本文按最保守假设设计）。
2. `credentials-local` 的 per-run environment override 是否会进 session log（影响 V2 类方案）。
3. `agent/pre-step` 的幂等记账是否可完全复用 `sessionProjections`（`time-context` 已示范）。
4. `spill` / telemetry 是否留有输出钩子可挂脱敏。
5. DSH 客户端插件能否承载非 React/iframe 形态的大块 UI（决定 M4 的可行性与 UI 迁移成本）。
6. `lookupCatalogContextWindow(model)` 对实际使用的模型是否命中（决定 §3.3 中第 1 条是不是真实痛点）。

## 13. 明确不做

- Room 群聊拓扑、微信/Discord Gateway、语音助手；
- 任何自研 harness（循环 / 压缩 / 会话格式 / 对话 UI）；
- DSH 客户端 UI 的原生移植（需要时先 iframe / 路由共存）；
- 把秘密整体迁入 `credentials-local`；
- 让本仓 Cordis 内核与 DSH 内核同进程共存；
- 为压缩精度迁移会话 SSOT（先修 §3.3）。

## 14. 附录：证据索引

**本仓代码**

| 主题                                                    | 位置                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 四层认知与总架构                                        | `../docs/product/architecture.md`                                                                                              |
| 分包与依赖约束（26 路由特性 / 2 工具特性 / 24 UI 特性） | `../docs/product/src-layering.md`                                                                                              |
| 压缩设计                                                | `../docs/cognition/compression.md`                                                                                             |
| 编码工作台                                              | `../docs/modules/coding.md`                                                                                                    |
| `MemoryService` 契约                                    | `../packages/capabilities/memory/service/memory-service.ts`                                                                    |
| remote MemoryService（HTTP 客户端）                     | `../packages/capabilities/memory/service/remote.ts`                                                                            |
| retain/reflect 的 LLM 注册点                            | `../packages/server/service/memory-engines.ts`（`:266-267`）                                                                   |
| 系统提示段                                              | `../packages/capabilities/memory/system-prompt-sections.ts`                                                                    |
| 压缩触发与会话窗口解析                                  | `../packages/core/compress/compressor.ts`（`:250-252`）、`../packages/core/config/compression-config.ts`                       |
| provider usage 落库                                     | `../packages/engine/loop-mechanism/loop-engine.ts`（`:428`）、`../packages/shared/pg-shapes/jsonb/message-payload.ts`（`:78`） |
| vault 契约与安全模型                                    | `../packages/shared/rpc-contract/frames/vault.ts`                                                                              |
| vault RPC 方法面                                        | `../packages/features/vault/habitat/routes/index.ts`                                                                           |
| 内核单根 Context 约束                                   | `../packages/kernel/context.ts`                                                                                                |

**外部资料**

- DeepSeek Harness 仓库：<https://github.com/deepseek-ai/deepseek-harness>（版本 `0.1.6-alpha.2`，MIT；本次调研基于本地 checkout）
- DSH 插件打包与安装：`docs/user/develop/basic/publish.md`（bundle vs profile、层序、GitHub 安装的构建脚本许可）
- DSH 凭证：`packages/credentials/README.md`、`packages/credentials/credentials-local/README.md`
- DSH 压缩：`packages/compaction/README.md`
- DSH 会话：`packages/session/README.md`、`packages/session-query/README.md`
- DSH 上下文注入模板：`packages/context/time-context/src/index.ts`
- DSH 回合事件消费：`packages/core/agent/src/consumed-work.ts`
- DSH tool 目录：`docs/tool-catalog.md`
- pi 仓库：<https://github.com/earendil-works/pi>
- pi 架构（第三方文档镜像，非官方）：<https://mintlify.wiki/pt-act/pi-mono/concepts/architecture>
- pi 扩展系统（同上）：<https://mintlify.wiki/pt-act/pi-mono/concepts/extensions>
- pi 程序化嵌入（同上）：<https://mintlify.wiki/pt-act/pi-mono/guides/programmatic-usage>

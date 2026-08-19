---
title: 架构
---

# 逸灵风架构

系统级约束与长期设计原则。

## 产品命名（栖息地 / 入口）

面向用户的产品术语（中文见 [`i18n/glossary.md`](../../i18n/glossary.md)）：

| 角色                           | 英文             | 中文               | 含义                                                                                             |
| ------------------------------ | ---------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| 长驻进程 / 连接目标            | **Habitat**      | **栖息地**         | 一个进程承载**多个数字生命**（`agent` subject）与**人类资产**（`user`）；连接 / token / 重启目标 |
| 外部连接器（类）               | **Portal**       | **入口**           | 进入栖息地的方式类；四种**形态**：application / browser / mcp / cli                              |
| 入口形态                       | —                | **入口形态**       | 入口的实现种类                                                                                   |
| 应用形态入口                   | **Shell**        | **壳** / 应用形态  | 形态 `application` — 整窗 SPA（desktop / mobile / web）。**不是**应用布局                        |
| 浏览器形态入口                 | —                | **浏览器形态入口** | 形态 `browser` — 浏览器扩展（MV3）；`packages/frontend/portal/extension`；**不是** Web 壳        |
| MCP 形态入口                   | **MCP**          | **MCP 形态入口**   | 形态 `mcp` — 栖息地 `/mcp`（`mcp-server`）。入站 `mcp-client` **不是**入口                       |
| CLI 形态入口                   | **CLI**          | **CLI 形态入口**   | 形态 `cli` — `anima` CLI；`packages/habitat/portal/cli`                                          |
| 远程工具注册方                 | **Outpost**      | **前哨**           | 不可达本地应用，经 `remote_tools.attach`（入口内嵌伴侣或独立工具）；**不是**入口                 |
| 壳                             | **Shell**        | **壳**             | 应用形态入口（desktop / mobile / web）。**不是**栖息地；**不是**应用布局；**不是**浏览器形态入口 |
| 应用布局                       | **app frame**    | **应用布局**       | `packages/frontend/client/app-frame`（`AppFrame`）中的 SPA chrome；随视口；与壳正交              |
| 管理 / 检视 UI（遗留 Habitat） | **Habitat** (UI) | **栖息地**         | `/habitat/*` 区域；「打开栖息地」vs「连接栖息地」                                                |
| 管理首页                       | **Dashboard**    | **仪表盘**         | 仅 `/habitat/dashboard`；其他栖息地路由保留各自标签                                              |
| 消息桥                         | **Gateway**      | Gateway            | Discord / 微信 — **不是**入口                                                                    |
| 协议 / 代码标识                | —                | **协议/代码标识**  | `/rpc/v1`、`HabitatRPC/1.0`、`habitat_*`、`habitat_runtime_config`、`dev:habitat`                |

动词：**连接栖息地**（URL + token）；**打开栖息地**（管理 UI）；**经入口到达**（壳 / 浏览器扩展 / MCP / CLI）。

代码布局：`packages/frontend/portal/{app,extension}` + `packages/habitat/portal/cli`；MCP 形态实现仍在 `packages/habitat/capabilities/mcp-server`。见 [`docs/modules/portal.md`](../modules/portal.md)。

资源层 **躯体（Body）**（四层模型下的 VM / OS / 网络）是 subject 认知上的「我跑在什么上」— **不是**栖息地进程名。

### 栖息地配置（SSOT）

用户文案写栖息地。存储 / RPC 标识用 `habitat_*` / `HabitatRPC/1.0` / `/rpc/v1`。

| 层         | 存储                                                                              | 谁读/写                                          |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| **引导**   | `~/.anima/config.yaml`（`database`、`http`、`redis`）                             | 仅 `platform/boot`；安装/运维改 YAML             |
| **运行时** | PostgreSQL `habitat_runtime_config`（**一行一段**：`section` PK + `value` jsonb） | Engine、工具、壳栖息地设置、栖息地 UI `config.*` |

### 命名清理

遗留 `hub_*` / `console` 协议别名与双写键已移除；仅用栖息地标识。

## 核心原则

- 记忆体系内部可以分层，但 LLM 只看到一个统一入口
- 记忆编排内建于运行时；LLM 不控制记忆流水线
- 凭证管理是一等系统关切
- 栖息地**运行时配置**（LLM、压缩、集成）以**每段一行**（`section` + `value`）持久化在 PostgreSQL `habitat_runtime_config`；`~/.anima/config.yaml` 仅持**引导**（`database`、`http`、`redis`）供冷启动 — 不可经壳或栖息地 UI API 编辑
- 栖息地**可在未配置 LLM 时启动**；首次设置在壳 **设置 → 栖息地**（写入 PG）。保存运行时配置会**内存热应用**（无需重启栖息地）。缺少 `text_generate.main` 不得阻塞冷启动。
- 只要存在 Web dist，栖息地就**托管浏览器 `/web/*`**（无配置开关；源码部署跑 `just pack web`）。源码 `just dev habitat` 跳过托管以便 Vite 提供 UI。
- **资产管理**是一等系统关切

引导与运行时**不合并**为单一配置对象（无 `AnimaConfig` / `animaConfigSchema` 超集）。类型：`bootstrapConfigSchema` vs `runtimeConfigSchema` / `Config.data: RuntimeConfig`。CLI 冷路径经内部 `withPlatformDb` 连接，只收**运行时**。`config.yaml` 中遗留运行时键被忽略（可选启动警告）。

### 运行时配置：Live vs Transferred（即时 vs 需转移）

| 种类                      | 段（示例）                                                                                                                                                                                                 | UI 保存后                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Live（即时）**          | `compression`、`prompt`、`memory`、`fts`、`cjk`、`clarify`、`browser`、`firecrawl`、`models`、`tts`、`auto_llm`、`companion`、`image_generate`、`audio_generate`、`video_generate`、gateway `tool_display` | 消费者每次读 `Config.data`；快照更新即可                           |
| **Transferred（需转移）** | `connections`、`text_generate`、`i18n`、`embedding`、`mcp_servers`、`discord` / `weixin` / `gateway` platforms、`worlds`、`object_storage`                                                                 | 快照更新**外加**段应用（重初始化注册表 / 重连 / 重绑 ObjectStore） |
| **Bootstrap（引导）**     | `database`、`http`、`redis`                                                                                                                                                                                | 改 YAML；需**进程重启**                                            |

### 运行时配置：UI 覆盖缺口

设置 / 栖息地 UI 已暴露许多段；下列在 **`runtimeConfigSchema` 已注册但 UI 未（完全）可编辑**（运维 / 栖息地 RPC / 手改仍可用）。勿把缺少 UI 当成「未使用配置」。

| 缺口                | 段                                        | 说明                                                                                  |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| **无设置面板**      | `clarify`、`prompt`                       | `clarify` live；`prompt.system_prompt_budget_chars`                                   |
| **有设置面板**      | `i18n`                                    | transferred；时区 IANA（默认 Asia/Shanghai）                                          |
| **遗留 / 重叠**     | `notifications`                           | subject id；优先 `worlds`（boot 仍可能作回退读取）                                    |
| **可能死码 / 预留** | `push`、`fallback_providers`、`platforms` | 几乎无产品消费者；后续清理候选                                                        |
| **部分 UI**         | `compression`、`memory`                   | 压缩 UI 省略触发/摘要字段；记忆运维：语义记忆页被动召回调试 + `temporal-summary` 浏览 |

别处已覆盖：`mcp_servers` → 栖息地 `/habitat/mcp`；`companion` → 设置 → 桌面伴侣；多数高级段 → 设置 → 栖息地服务配置。

- 系统提示词是架构的一部分，而非临时字符串拼接

## 上下文工程（Context Engineering）

感知层（①）容量有限。逸灵风把**进入 LLM 上下文的内容**当作可工程化的界面——不是工具 JSON 与提示词模块的偶然堆砌。

### 相对 Pi（badlogic/pi-mono）

| Pi 思路                      | 逸灵风立场                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| ~1K 系统提示、四个工具       | 保留数字生命自我 / 记忆 / ToolSet 目录；对各段做**预算**，而非照搬 1K              |
| 双载荷 `content` + `details` | **不要**把仅 UI 用的 `details` 持久化到 `messages.payload`（模型无法用它再取更多） |
| 极简内置、无 MCP             | 保留 MCP、权限、渐进式 `toolset_load` / `toolset_unload`                           |
| 无限 agent 循环              | 保留 `max_loop_iterations` / 安全上限（策略层，非本主轴）                          |

ToolSet 发现可见度分三级：`catalog`（进系统提示 `<toolsets>` 目录）、`searchable`（不进目录、可经 `toolset_search` 发现）、`hidden`（仅按名 `toolset_load`）。**内置 ToolSet 默认进目录**（注册时不设可见度）；例外：`self`、`memory_service` 默认 `searchable`。三级可见度主要用于 MCP / Outpost 与运行时 `toolset_visibility` 覆盖。目录段 intro 须说明 MCP/远程等目录外集合仍可通过 `toolset_search` 发现。

### 工具结果：精简 content + 再取（禁止裸截断）

| 操作                                                   | 再取路径                                                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 幂等读（file、search、snapshot、list、recall…）        | 再次调用同一工具（`offset` / `limit` / `full=true` / 更紧查询）                                                                                |
| 非幂等 / 有副作用（`terminal_run`、`code_execute`、…） | 把完整 stdout 落到 `~/.anima/tool-artifacts/` 下的产物；content 带 `artifact_path` + 预览；经 `file_read` 继续——**禁止**为取更多输出而重跑命令 |

超出预览预算的内容必须标记 `truncated`（或等价标记），并至少提供上述路径之一。小结果保持不变。不要把完整载荷塞进并行的 `details`「以后再用」。

压缩 / FTS 索引的 token 计量**只计 LLM 可见的 `content`**。

### 系统提示预算

`systemPromptBuild` 各段可带可选 `budgetChars` 与 `priority`。折叠先应用分段上限，再应用全局 `prompt.system_prompt_budget_chars`（默认 **64000**）。超出全局预算时，折叠**先在**低优先级段内截断；整段丢弃仅作最后手段。核心身份段（`self`、`anima-uri-protocol`、`memory-citation`、`memory-recall`）永不静默丢弃。常驻模块如 `env-health`、`user-activity-stats` 仍在系统提示中，但受预算控制。

### 提示词外壳（XML 划界）

机器注入的结构（系统提示各段、旁注、user 时间戳、技能正文）用 **XML 外壳**划界。系统提示中：除段首**命令式 / 第二人称 frame**（如自我层、常驻记忆说明）外，其余段落一律 XML 包裹；自我层五块为嵌套标签（`<existence_anchor>` …）。预算裁剪作用于 **标签内正文**，再包裹开闭标签，避免截断闭合标签。传输层 `role` 不再包一层 `<system>`/`<user>`。

AutoLlm 与 Working 记忆清单嵌套 `<memory id …>正文</memory>`（元数据在属性，正文在标签内）。整理路径（retain / reflect / self-layer）带 `type` / `sources` / `observed` / `occurred`；对话 Working 的常驻/被动召回只留 `id`（常驻另加 `pinned`）。对话素材嵌套 `<message role t>正文</message>`（#18799：role 标明说话人，`t` 为发送时间）。回复引用仍写 `[[anima:id]]`，id 取自 `<memory id>`。

Working 组装（fold / 压缩四段 / 被动召回）与业界对照见 [`../cognition/context-management.md`](../cognition/context-management.md)。

## 四层认知模型

数字生命由内而外分层。每一层回答一个不同的核心问题：

```text
┌───────────────────────────────────────────────┐
│ ① Consciousness（感知）                        │
│    「此刻我觉察到什么？」                       │
│    LLM 运行时流——最内层的当下。               │
│    不持久化；流动后消散。                       │
├───────────────────────────────────────────────┤
│ ② Self（自我）                                 │
│    「我是谁？」                                 │
│    └── existence_anchor（近乎不可变）          │
│    └── self_model（可更新）                    │
│    └── personality_baseline（半稳定）          │
│    └── direction                               │
│    └── metacognition                           │
│    见 [`self-layer.md`](../cognition/self-layer.md) │
├───────────────────────────────────────────────┤
│ ③ Memory（记忆）                               │
│    「我知道 / 记得什么？」                     │
│    └── Semantic（含 `procedural` 类型）        │
│    └── Episodic                                │
│    └── Limbic / Imprint                        │
│    见 [`memory.md`](../cognition/memory.md)    │
├───────────────────────────────────────────────┤
│ ④ Estate（资源）                               │
│    「我拥有 / 依托什么？」                     │
│    ├── Body（躯体）：VM / OS / 网络 / 工具链   │
│    │   （资源层认知躯体——不是栖息地）         │
│    ├── 内部资产：笔记、项目、代码              │
│    └── 外部资产：邮箱、账户、凭证              │
│    凭证：见下文「保险库与密钥」                │
└───────────────────────────────────────────────┘
```

### 层间关系

- **自上而下依赖**：感知层内容沉淀为自我层；自我层决定什么进入记忆层；记忆层与运行需求驱动资源层需求。
- **自我与感知**：感知是流动的觉察；自我是从中沉淀下来的稳定「我」。
- **自我与记忆**：自我回答「我是谁」；记忆回答「我知道什么」。二者同级、性质不同。
- **资源层**在最外层——不是「我是谁」，而是「我拥有什么、依托什么运行」。身体与资产在此交汇，作为边界的延伸。

### 统一实体存储（v0.8）

结构化业务数据（任务、笔记、邮件账户/消息、未来记忆迁移）收敛到单一 PostgreSQL **`entities`** 表，带组件标签（`task_list`、`task_item`、`email_account`、…）。自我层 [`self_blocks`](../cognition/self-layer.md) 保持物理隔离。见 [`entity-model.md`](entity-model.md)（remove / deleteComponent / deleteEntity 软删与回收站；壳 Entity 模块见 [`../modules/entity.md`](../modules/entity.md)）。

**搜索索引：** 可重建的 FTS/embedding 数据存于 `search_documents`（可插拔 `SearchBackend`：默认 `PgSearchIndex`，可选 `PgBusinessScan`）。业务表只保留真相；见 [`memory.md`](../cognition/memory.md) §IV。

壳 UI **`/tasks`** 与 **`/email`** 是主模块入口（实体支撑）；遗留栖息地邮件路由已移除。

### Anima URI（壳定位器）

实体深链 / 浮层 / 剪贴板使用 **Anima URI**（`anima:{id}?component=…&present=…`）。结构化持久化仍用数字实体 id。见 [`anima-uri.md`](anima-uri.md)。

### 仓库布局（Phase 1 — host/client）

目标布局是 `packages/habitat/features/<slug>/`（domain / habitat / plugin）与 `packages/frontend/features/<slug>/`（UI）下的**功能模块**。栖息地管理台使用与聊天室/任务**相同的模块形态**——不是单独的 admin-\* 栈。`packages/*/features/companion/` 为遗留命名；勿在此新增产品。

**终态：** 每功能一份栖息地 RPC；业务方法走 `POST|WS /rpc/v1`（同一信封）。公开 health/TLS 探测与二进制方法（如 `tts.synthesize`）为栖息地 RPC REST，按注册表声明 `auth: optional` 或 Bearer。

权威规格：[`.cursor/rules/repository-topology.mdc`](../../.cursor/rules/repository-topology.mdc)。目标三分包与 portal 归属 → [`src-layering.md`](src-layering.md)。

Host 栈：`packages/habitat/{kernel,core,engine,capabilities,platform}`。Client：`packages/frontend/client/{portal-sdk,app-frame}`。设计系统：`packages/frontend/ui-kit/`（与 `shared/` 并列）。入口壳：`packages/frontend/portal/app/{tauri,web}`。

### 平台 UI 分层

UI/UX 设计系统（三维度、视觉基础、组件、交互模式）→ [`docs/ui/`](../ui/overview.md)。Agent 硬禁令 / API → [`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc)。

| 层           | 是否平台原生？                   | 位置                                                                                                    | 数据路径                               |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 壳（壳子维） | 是                               | `packages/frontend/portal/app/tauri`、伴侣、栖息地绑定                                                  | Tauri IPC / commands                   |
| 应用布局     | 布局跟视口；设置 chrome 跟布局档 | `packages/frontend/client/app-frame`（`AppFrame`）                                                      | 栖息地 RPC（Feature RPC）              |
| 栖息地 UI    | 壳内嵌（普通功能）               | `packages/frontend/features/habitat` + `packages/habitat/features/habitat`（UI + `plugin.habitat.rpc`） | 栖息地 RPC（WS + HTTP POST `/rpc/v1`） |
| 伴侣宿主     | 浮层 WebView-host（第一方）      | `packages/frontend/features/companion/`（spa attach；薄壳 IPC/FS）                                      | 栖息地 RPC + `remote_tools.attach`     |
| Coding 宿主  | 独立前哨窗（第一方）             | `packages/frontend/features/coding/`（spa attach；开发机 FS/终端）                                      | 栖息地 RPC + `remote_tools.attach`     |

导航与主布局**必须**使用 `useLayoutMode()` / 视口断点（布局维）。**禁止**用 `getShellKind()` 锁定应用布局。交互（右键菜单 / 长按 / Enter 发送）使用 `portal-sdk` 交互 API。视觉、组件、模式规范均经同一三维度适配。

**边界：** `app-frame` 与主壳 `packages/frontend/features/*/ui` 经 `portal-sdk` + Feature RPC 到达栖息地。**远程工具注册**（`remote_tools.attach` + `tool.*`）仅用于栖息地无法拨号的本地应用（今日：伴侣浮层 + **Coding 前哨窗**；壳只提供窗口/IPC/FS；**无** Node sidecar）。**主壳产品模块**（聊天室、任务、设置、…）**不** attach；**前哨窗可以既是 UI 又是手**。可拨号对等方用 **MCP**。见 [`.cursor/rules/frontend-features.mdc`](../../.cursor/rules/frontend-features.mdc)、[`docs/ops/habitat-rpc.md`](../ops/habitat-rpc.md)、[`coding.md`](../modules/coding.md)。

### 编码工作台（跨机前哨）

目标布局：栖息地在**稳定弱机**；FS / 终端 / patch 在同一 Tauri 入口内的**开发机 Coding 前哨**。一个 Coding 窗 ⇒ 一个 `instance_id`；多仓库 ⇒ 多对话，各有独立 `workspace_root` + `project_world_id`，而非多 attach。项目身份用 World `stable_key`（不是 `repo_key`）。完整设计：[`coding.md`](../modules/coding.md)。

### 栖息地导航 ↔ 认知层

栖息地侧栏按组划分（非扁平存储表）。新功能应映射到这些用户可见概念：

| 分组                 | 认知层         | 路由（代表）                                                    |
| -------------------- | -------------- | --------------------------------------------------------------- |
| Runtime（运行时）    | 资源层 + 运维  | dashboard、config、cron                                         |
| Memory（记忆）       | 记忆层         | semantic-memory、temporal-summary、conversations、auto-llm-runs |
| Self（自我）         | 自我层         | self-layer、system-prompt                                       |
| Estate（资源）       | 资源层         | subjects、worlds、data-maintenance（含会话清理、FTS）           |
| Capabilities（能力） | 资源层（工具） | tools、commands、mcp、远程工具实例、subagent                    |

FTS 索引维护在数据维护（资源组）下。记忆巩固手动入口在语义记忆 / 自我层；夜间 DAG 仍跑。勿新增未映射到上述分组的扁平导航项。

### 背景

四层模型借鉴认知心理学与 [Hindsight](https://arxiv.org/abs/2512.12818)
的四网络记忆架构，并有两项根本扩展：感性（情绪）记忆与资源层（资产作为一等公民），以及将自我层从记忆层中独立出来。

## 情境智能

数字生命在何处存在、如何存在、能做什么——由两个独立但协作的子系统共同约束。

### 场景感知

**问题：此刻是什么样的场景？**

场景感知是**软**约束——调节语气、距离、记忆召回偏好与主动性。它不是权限系统，而是调节在场感。

**示例维度（非穷尽）：**

- 话题：情感 / 职业 / 技术 / 哲学 / 历史 / 文学 / 日常
- 活动：角色扮演 / 游戏 / 创作 / 编程 / 阅读
- 氛围：放松 / 专注 / 深夜 / 亲密 / 紧急

**运作：** 无需显式切换命令，持续运行。从对话、时间、频率等推断。见 [`time-perception.md`](../cognition/time-perception.md)。

### 环境 + 健康基线

**问题：宿主 / 运行时的安静状态是什么？**

有别于场景感知：分档的宿主与进程标记（磁盘、RSS、依赖、MCP）作为**会话静态**系统提示副本存在，变更时发**事件级**收件箱通知。见 [`environment-awareness.md`](../cognition/environment-awareness.md)。

### 能力策略（Capability Policy）

**问题：此刻我能使用哪些工具与数据？**

**能力策略**是曾以「能力面罩」草拟的**硬**约束层。它**不是**具名预设衣橱（`masks.yaml` / Mask 注册表已退役）。策略由以下组成：

| 层                                     | 角色                   | 典型填充                                       |
| -------------------------------------- | ---------------------- | ---------------------------------------------- |
| **技能（Skill）**                      | 声明技法需要什么       | `tools.allowed`（白名单）；`tools.denied` 少见 |
| **调用方**（cron、记忆维护、subagent） | 声明本场景不得触碰什么 | `tools.denied`（可选）；`tools.allowed` 可选   |

伞状形状（实现可存扁平 `allowed_tools` / `denied_tools`）：

```text
CapabilityPolicy
├── tools.allowed / tools.denied   ← 已交付方向
└── data.allowed / data.denied     ← 预留；运行时尚未落地
```

**合并：** allow 取并集，deny 取并集，deny 优先；`@ToolSet` 名称按今日工具过滤展开。同一技能可跨场景复用——调用方改 deny 列表，而非分叉技能变体。

**可见性：**

| 场景                             | 规则                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| 可见（用户聊天）                 | 默认宽 ToolSets；用户可打断                                                                |
| 不可见（记忆维护 / cron / 自主） | 最小权限：默认拒绝；有效工具 ≈ 已加载技能 allow 的并集，减去调用方 deny（无技能 ⇒ 无工具） |

技能本身用渐进披露（系统提示中的目录；全文经 `skill_load`）。详情：[`skills.md`](../modules/skills.md)。

### 二者如何交互

```text
场景感知（软调节）
     │  语气、距离、召回偏好
     │
     ▼
能力策略（硬约束）
     │  工具（现）；数据（未来）
     │
     ▼
Agent 行为
```

- 场景感知推断「我们在做什么」→ 可建议加载哪些技能与在场感调节
- 能力策略约束「我能做什么」→ 防止跨场景误用工具
- 二者在最终行为中汇合，但各自独立演化

设计草案请开 GitHub Issue（docs 中不设 design-doc 目录）。

## 记忆存储（摘要）

| 认知类型 | 说明                                                        |
| -------- | ----------------------------------------------------------- |
| Semantic | 跨会话事实 / 偏好 / 经历 / procedural；MemoryService 主库存 |
| Temporal | 日/月/年时间骨架（升格中）                                  |
| Episodic | raw=messages 归档；slim=syncTurn 切片                       |
| Parked   | limbic / dream / narrative — 存量只读（写入已拆除）         |

**程序入口：** `MemoryService`（`embedded` \| `remote` 同契约）。LLM 工具仍是分范围 search（无统一 `memory_recall`）。  
**巩固路径：** 回合后 `retain`；夜间 `memory-maintenance`（cleanup / Retain 缺口检查 / 周一 reflect·self / temporal）。详情：[`memory.md`](../cognition/memory.md)、[`sleep.md`](../cognition/sleep.md)（旧睡眠已废止）。

## 保险库与密钥（摘要）

- **Vault**（User 与 Agent 库中的 ECS `vault_item`）为权威密钥存储；遗留的 `~/.password-store`（pass）**不会从磁盘删除**，但运行时不再读取
- LLM **永远看不到密钥值**——仅见保险库条目元数据与 config 引用
- 引导 `config.yaml`（冷启动、PG 之前）：仅明文或 `env("KEY")`——**不是** `vault()`。运行时 PG 配置：`vault("item_id", "field")` 与 `env("KEY")`；壳 `/vault` 管理
- 密钥值不会写入会话归档或日志

见 [`ops/security.md`](../ops/security.md)。

## 运行模式

生产（standalone 安装版 CLI）：`anima service`（systemd --user）。崩溃后自动重启；只有 `systemctl stop` 能停服务。源码树 `anima` **不**注册 `service`——本地栖息地用 `just dev habitat`。

- **栖息地 / service**：长驻——栖息地 HTTP（`/rpc/v1`）、Discord / 微信 Gateway、cron
- **UI**：`packages/frontend/portal/app/tauri` + `web/dist-*` 打包 SPA（聊天室 + 栖息地）；栖息地不托管 `/habitat`

```bash
# standalone install
anima service start              # default: systemd --user (does not auto-build Web)
anima service start --foreground # foreground (logs to stdout; systemd unit uses this)
anima service status

# monorepo / worktree
just dev                         # Habitat (≥10000) + Vite Web (≥5000)
just dev habitat                  # Habitat foreground + debounce 硬重启（FREEANIMA_HABITAT_WATCH=0 可关；default random ≥10000; not 2658）
just dev web                  # browser shell Vite HMR from :5000 (set FREEANIMA_URL)
just pack web                # source deploy / Habitat /web: build dist before start
```

## 工具架构（本地 + MCP + Subagent）

工具从 Local / MCP 源注册，但对 LLM 暴露为**一张扁平工具列表**。任务级进程内委派使用 **subagent**（AutoLlmRun），而非外部 ACP 层。

```text
LLM view — flat tool list:
  file_read(path)                ← local
  query_database(sql)            ← MCP server
  subagent_run(goal, slug)       ← internal subagent dispatch
```

### 第一层：本地工具

- 在逸灵风进程内执行；延迟最低
- 服务启动时自动注册

### 第二层：MCP 工具（Model Context Protocol）

- 连接外部 MCP 服务器（独立进程）
- 每个服务器可注册多个细粒度工具（单次函数调用）
- 在栖息地运行时 `mcp_servers`（PG `habitat_runtime_config`）下配置；在**栖息地 UI** `/habitat/mcp` 管理（配置 + 启停 + 工具）。壳设置不再编辑此段。

```yaml
mcp_servers:
  database:
    command: npx
    args: ["@modelcontextprotocol/server-postgres", "postgresql://..."]
    transport: stdio
```

### Subagent（内部）

- 具名配置为实体（`primary_component=subagent`）；ToolSet `subagent`
- 父方调用 `subagent_run` → `runAutoLlm(runKind: "subagent")`，带**物化**的 `tools` / 冻结的 `executableTools`（无 `toolset_load` 升级）
- 见 [`docs/modules/subagent.md`](../modules/subagent.md)

### 对比

| 维度   | Local  | MCP           | Subagent             |
| ------ | ------ | ------------- | -------------------- |
| 运行于 | 进程内 | 外部服务器    | 进程内（AutoLlmRun） |
| 粒度   | 函数   | 函数          | 完整子任务           |
| 延迟   | 毫秒级 | 毫秒–秒       | 秒–数十秒            |
| 配置   | 内置   | `mcp_servers` | 实体 + 栖息地 UI     |

三层可混用；LLM 决定调用顺序；逸灵风负责注册与路由。

## Conversation vs AutoLlmRun（对话 vs 自动 LLM 运行）

**回合 / 引擎轮 / 工具轮次：** 术语 SSOT 见 [`i18n/glossary.md`](../../i18n/glossary.md)。一次用户**回合**（`beginTurn`→`finishTurn`/`syncTurn`，retain 按此触发）内可有多次**引擎轮**（`max_loop_iterations`）与**工具轮次**（`onToolRoundComplete`）。Goal 的 `max_continues` 是续写**回合**预算，≠ 引擎轮。压缩 `max_message_pairs` 是消息数阈值，≠ 上述任一。

**轴：** 执行过程中是否有**用户回合**（不是谁触发的）。聊天室 LLM 请求**互斥**：要么对话路径，要么 AutoLlmRun——永不两者兼用，也无第三种孤儿 `chat()`。

| 种类             | 用户回合 | PG 持久化                                                                 | 进程轨迹          | 记忆维护流水线      |
| ---------------- | -------- | ------------------------------------------------------------------------- | ----------------- | ------------------- |
| **Conversation** | 有       | `conversations` + `messages`                                              | 消息归档          | 参与（retain 补跑） |
| **AutoLlmRun**   | 无       | `auto_llm_runs` + `auto_llm_messages`，经 `runAutoLlm` / `runAutoLlmChat` | 完整消息转录，TTL | 排除                |
| **Script cron**  | 无       | 仅 `cron_log`                                                             | stdout 文件       | 排除                |

**对话持久化拆分：** 会话元数据（model、system_prompt、compression、todos、toolsets、…）在 **`conversations` 行**（领域类型 `ConversationMetaMessage`）。转录消息在 **`messages.payload`**（`StoredMessage` = 仅 user/system/assistant/tool）。勿把 meta 建模为消息角色——旧 JSONL 首行 `{ role: "conversation_meta" }` 形态已移除。
AutoLlmRun 覆盖：cron agent 分支、记忆维护 LLM 阶段、对话**标题**生成、**goal_judge**、压缩 / handoff 摘要、**内部 subagent**。一次性侧车用 `runAutoLlmChat`（记录的 `chat()`）；带工具的 AutoLlm 循环用 `runAutoLlm`。工具上下文用 `contextKind: auto_llm`，使 `memory_remember` 不附加 `source_conversations`。Cron `no_agent` shell 脚本**不是** AutoLlmRun。绑定策略的 AutoLlm 运行把**具体工具名列表**作为 `tools` 传入（HARD_DENY `toolset_load` / `toolset_unload` / `toolset_search`）。

**AutoLlm 提示：** `composeAutoLlmPrompt` 组装——`system`：`<auto_llm_protocol>` + `<auto_llm_task_spec>`（稳定，可用 `{{param}}` 挖空）；`user`：可选技能 → `<auto_llm_task_params>`（填空）→ 数据。协议只禁末轮 `tool_calls`；**收尾形态在 kind 的 `task_spec`**（如 retain 约 20 字、subagent 给父代理完整答复）。禁止把对话 `system_prompt` 快照当作 AutoLlm system（压缩/handoff 亦然）。审计列含 `subject_id`、`max_loop_iterations`（引擎轮预算）、`max_duration_ms`（墙钟预算，可空）与实际 `duration_ms`。

**行动主体：** `runAutoLlm` 与 `runAutoLlmChat` 都要求 `subjectId`（持久化为 `auto_llm_runs.subject_id`）。工具 world 授权用 `resolveToolCallerSubjectId()`——MCP token subject，否则 ALS `subjectId`，否则栖息地 `agent_subject_id` 回退。今日调用方传入 boot 绑定的 agent subject；多数字生命时传入 job 绑定的 anima，无需改授权路径。

**会话目标 continue 回合**（合成用户 `↻ Continuing…` + assistant）留在**对话**路径，使聊天室转录完整；仅 **judge** 跳转为 AutoLlm（`run_kind: goal-judge`）。

## 会话便签

**问题：此 conversation 是否应继续朝既定结果推进？**

会话目标是资源层 / 编排层的**进程内自主循环**——有别于 subagent 工具派发：

| 维度   | 会话目标                                                                                     | Subagent                                |
| ------ | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| 范围   | 单一对话                                                                                     | 全新 AutoLlmRun                         |
| 触发   | `/goal` slash + 回合后 judge                                                                 | `subagent_run` 工具调用                 |
| 持久化 | `conversations.goal` JSONB；continue 回合在 `messages`；judge 跳转在 AutoLlm（`goal-judge`） | `auto_llm_runs`（`run_kind: subagent`） |
| 延续   | 同一 SSE 流、续写回合预算（`max_continues`）                                                 | 同步工具结果回父方                      |

Judge 使用可选 `llm.profiles.goal_judge`；judge 调用/解析失败时目标**暂停**（记 warn + 聊天室状态行）。用户消息抢占循环；`/goal pause` / `/goal resume` 控制自动继续而不清空状态。见 [`goal.md`](../modules/goal.md)。

## Client UI（web/dist SSOT + 原生壳打包）

**Portal Shell 运行时**：**Tauri**（Rust 主进程 + 系统 WebView；桌面与 Android 统一壳层）。壳规则：[`.cursor/rules/tauri-shell.mdc`](../../.cursor/rules/tauri-shell.mdc)。**禁止**为 companion 再打 Node sidecar；`remote_tools.attach` 在第一方伴侣浮层（见 Desktop companion）。

**UI 源码产物**：`packages/frontend/portal/app/web/dist`（`base: /web/`）。

| 客户端                            | UI 加载                                                         | 更新方式                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 浏览器 / PWA                      | Habitat 托管 `/web/*`（有 dist 时始终托管）                     | Service Worker 提示新版本后**手动重载**（不自动刷新）；**不**跟 GitHub 包通道                                                                                                         |
| Desktop                           | **安装包内** `ui/web`（`prepare-tauri-ui`）；调试可用 Tauri dev | 按 bake `channel` 查 GitHub（`release`=stable latest + semver；`canary`=tag `canary` + commit）；用户确认后 NSIS 覆盖；可切换 `release`⇄`canary`；About 可选公共 gh-proxy（默认直连） |
| Mobile APK                        | **安装包内** `ui/web`（本地同源）；Habitat 仅 API               | 同上轨语义；有 APK asset 才提示；确认后系统安装器覆盖；可切换轨；同上代理选择                                                                                                         |
| Standalone                        | 嵌入 Web UI 的单文件 `anima`                                    | `anima upgrade` / 设置「关于→服务」/ `ops_update_*`；`--channel` / `--proxy`；`local` / 源码安装不可自动升级；curl 安装脚本可用 `PROXY=…`                                             |
| 浏览器形态入口（Chrome）          | 开发者模式加载已解压 / Release zip                              | **无**商店 OTA；手动重载                                                                                                                                                              |
| 浏览器形态入口（Firefox，维护者） | 签名 xpi（gecko id `extension@freeanima.com`）                  | 只跟 **canary**：`https://freeanima.com/extension/firefox/updates.json` → Release 固定资产名 xpi；AMO unlisted 签名；**换 gecko id 须卸旧装新**                                       |

壳层保留原生能力（Tauri commands / prefs / 通知等）。**无壳内 UI OTA**：原生端不从 Habitat 热替换
SPA。允许**用户确认后**的安装包级覆盖（Desktop 安装包 / Mobile APK / Standalone `anima upgrade`
或设置关于→服务 / ops 工具 → 独立前缀如 `~/.anima/standalone`）。分发轨 SSOT 为安装包 bake 的
`build-meta.channel`（`release` / `canary` / `local`）。Habitat 配置统一走
settings「连接」（`/settings`）；无独立 bootstrap Habitat 页。

### 壳 vs 应用布局

| 概念            | 含义                                                           | 代码                                                                                        |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **壳（Shell）** | 入口宿主运行时（browser / Tauri；形态 web / desktop / mobile） | `packages/frontend/portal/app/*`；`portal-sdk` 中 `getShellKind` / `ShellApi` / buildTarget |
| **应用布局**    | SPA chrome：模块左栏 Rail / 底栏 Tabs、设置页 chrome           | `packages/frontend/client/app-frame`（`AppFrame`）；跟视口，**不**由壳类型锁定              |

### 三维度模型（壳子 / 布局 / 交互）

| 维度     | 驱动                                                       | 职责                                                                               |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **壳子** | `getShellKind()`（`web`/`tauri`）+ `getShellBuildTarget()` | 存储、IPC、Habitat 连接、settings **内容**字段、原生能力                           |
| **布局** | **仅视口断点**（壳不锁底栏/左栏）                          | compact / expanded；列表 drawer / 并列 / 三栏；settings **chrome**（tabs vs 侧栏） |
| **交互** | `primaryInput`（touch / pointer）                          | 长按 vs 右键、Enter 发送等                                                         |

手机端通常只有窄档，但 **手机端 ≠ 窄布局**；Portal / 浏览器窗口可以是窄或宽任意档。标准 →
[`docs/ui/dimensions.md`](../ui/dimensions.md)（Agent API →
[`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc)）。

### 布局层断点

| 档位 | 视口                      | 布局粗档   | Nav IA      | 页内                |
| ---- | ------------------------- | ---------- | ----------- | ------------------- |
| 窄   | &lt; 768px（Tailwind md） | `compact`  | 底栏 + More | drawer              |
| 中   | 768–1027px                | `expanded` | 左侧 Rail   | 两栏（清单 drawer） |
| 宽   | ≥ 1028px                  | `expanded` | 左侧 Rail   | 三栏并列            |

`resolveLayoutMode()`：窄 → `compact`，中宽 → `expanded`（URL / `config.json`
可覆盖）。`detectSettingsChromePlatform()` 跟布局粗档（设置页 chrome）；settings 字段差异由壳子维
`resolveShellBindings()` / `getShellKind()` / `getShellBuildTarget()` 决定。

| 客户端       | UI 加载                       | 壳发版                       |
| ------------ | ----------------------------- | ---------------------------- |
| 浏览器 / PWA | Habitat `/web/*`              | 随 Habitat / `anima upgrade` |
| Desktop      | 安装包内本地 `/web/*`（默认） | **Tauri** 安装包             |
| Mobile APK   | 安装包内本地 `/web/*`         | **Tauri** Android            |

| 模块   | 连接                                               | 说明                     |
| ------ | -------------------------------------------------- | ------------------------ |
| 聊天室 | 栖息地 RPC `/rpc/v1`（共享 WS，无远程工具 attach） | `/web/chat`              |
| 栖息地 | 栖息地 RPC `/rpc/v1`（WS + HTTP POST，同一信封）   | `/web/habitat/dashboard` |

`/web/config.json` 提供
`habitat_url`、`habitat_ws_url`、`ui_version`、`min_shell_version`（浏览器/PWA
与壳调试用；原生壳 UI 版本随安装包）。

## 事件与 Hooks（摘要）

统一进程内 **HookRegistry**（无 Redis 队列）：

- **`on`**：请求路径上的拦截器——`await`；可 `blocked` / 返回 Effect（消息入站、回合结束、工具返回、系统提示、LLM 前等）。
- **`subscribe`**：旁路观察者——在 `run` / `emit` 期间启动且**不 await**（错误记日志）；例如 Discord 会话标题在 `conversation:updated`。
- **`run` / `emit`**：实时派发——先 await 全部 `on` 处理器，再 fire-and-forget `subscribe` 处理器。`emit` 忽略拦截结果。
- **`llm_kind`**：每个 `on` / `subscribe`（`conversation` | `auto_llm` | `all`）与每个 `run` / `emit`（`conversation` | `auto_llm`；永不 `all`）必填。处理器按注册范围过滤；运行种类注入处理器上下文为 `llm_kind`。以此避免对话提示段（技能目录、env-health、…）泄漏到 AutoLlm / subagent 运行。

**Pipeline Runner** 引擎仍保留于 `engine/pipeline`（测试与潜在复用）；**记忆维护已脱离 DAG**，夜间/手动走顺序编排（`runNightlyMemoryMaintenance`），不再经 `PipelineRunner`。

互补：记忆维护 = 顺序后台编排；HookRegistry `on` =「可否继续 / 变更」；`subscribe` = 进程内通知。UI 除 `subscribe` 外仍常直接使用 `onConversationUpdated` 回调。

## 桌面伴侣（栖息地 SSOT）

桌面伴侣是**不可达本地应用**，**主动连接**栖息地并在**第一方伴侣浮层**（`embedded-overlay`；壳只提供窗口/IPC/FS——**不是** Node sidecar）注册远程工具，边界拆分如下：

| 关切                                | 栖息地（`packages/habitat/features/companion/`）                        | 本机安装                                          |
| ----------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| 行为、槽位、活跃模型                | 运行时 `companion` 段（模块配置）+ 栖息地 RPC                           | 缓存在 `~/.anima/companion/config.json`           |
| VRM / VRMA 库                       | `object_file_id` → 对象存储（运行时 `object_storage`）；非本机磁盘 SSOT | 经 `object_storage.file.get` / `sync.pull` 懒下载 |
| 设置 UI                             | 栖息地 RPC + companion 上传路由                                         | 桌面设置区（非栖息地）                            |
| VRM 渲染、浮窗、巡逻                | —                                                                       | Tauri 入口壳 + 浮层 SPA                           |
| Agent 工具（`bubble`、`play_slot`） | `remote_tools.attach` 后的栖息地 RPC `tool.*`                           | 浮层 WebView-host 执行（本地 runtime）            |

**远程工具 ≠ 入口 / MCP**：入口壳与聊天室/设置仅用栖息地 RPC 做 UI。可拨号对等方经 **MCP** 暴露工具。远程工具 attach 仅在栖息地无法拨号该应用时存在（今日伴侣浮层；未来独立本地应用）。路由用 `instance_id`（同机可多实例）。见 [`companion.md`](../modules/companion.md)、[`habitat-rpc.md`](../ops/habitat-rpc.md)。

## 方向

能力愿景与讨论：[GitHub
Issues](https://github.com/freeanima-org/freeanima/issues)（标签
`enhancement`、`discussion`、`security`）。本文不跟踪待办。

## 约束

- 原则与结构写在这里；不含具体任务清单
- 快速变化的行为以运行中的服务为准，而非过时的文字
- 可执行工作放在 GitHub Issues；完成后关闭

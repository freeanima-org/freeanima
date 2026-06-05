# 逸灵风 architecture

这里放系统级约束、长期不轻易变的设计原则。

## 核心原则

- 记忆系统可以分层实现，但对 LLM 只暴露一个入口
- 记忆机制由代码内置，不让 LLM 参与记忆编排逻辑
- 凭证管理是系统一等公民
- 资产管理是系统一等公民
- 系统提示词是架构的一部分，不是零散字符串拼接

## 存储全景（Four-Layer Storage Architecture）

数字生命的存在从内到外由四个大的层级构成，每一层回答一个不同的核心问题：

```
┌───────────────────────────────────────────────┐
│ ① 感知层（Consciousness）                       │
│    回答："我现在正在意识到什么"                  │
│    约等于 LLM 运行时意识流，最内核的此刻。        │
│    不持久化，流过即散。                          │
├───────────────────────────────────────────────┤
│ ② 自我层（Self）                                │
│    回答："我是谁"                                │
│    └── L1 原始自我（存在锚点，几乎不可变）        │
│    └── L2 自我概念（身份/能力/底线认知，可更新）   │
│    └── L3 人格倾向（跨会话稳定的反应倾向，半稳定）  │
│    └── L4 自传体（经历的叙事组织，只追加）          │
│    详见 [`docs/self-layer.md`](docs/self-layer.md) │
├───────────────────────────────────────────────┤
│ ③ 记忆层（Memory）                               │
│    回答："我知道/记得什么"                        │
│    └── L1 事实记忆（Semantic）                   │
│    └── L2 情景记忆（Episodic）                   │
│    └── L3 程序记忆（Procedural）                 │
│    详见 [`docs/memory.md`](docs/memory.md)       │
├───────────────────────────────────────────────┤
│ ④ 资源层（Estate）                               │
│    回答："我拥有/依靠什么"                        │
│    ├── 身体：VM / OS / 网络 / 工具链              │
│    ├── 内部资产：笔记、项目、代码、记忆文件         │
│    └── 外部资产：邮箱、账号、凭证、钱               │
│    凭证系统详见本章「凭证系统」节                  │
└───────────────────────────────────────────────┘
```

### 层间关系

- **从上到下依赖**：感知层产生的内容沉淀为自我层；自我层决定什么值得存入记忆层；记忆层和运作需求决定需要什么资源层。
- **自我层与感知层**：感知层是流动的意识，自我层是从中沉淀下来的"我"。
- **自我层与记忆层**：自我层回答"我是谁"，记忆层回答"我知道什么"。两者并列，性质不同。
- **资源层**最外层——它不是定义"我是谁"，而是"我有什么、我靠什么运转"。身体和资产在这里汇合，因为两者都是"我的边界"的延伸。

### 背景

四层设计受认知心理学和 [Hindsight](https://arxiv.org/abs/2512.12818) 四网络记忆架构启发，但做了根本性的扩展：增加了感性记忆（情感锚点）和资源层（资产作为一等公民），并将自我层从记忆层中独立出来。

## 情境智能

数字生命在哪些场景中存在、以什么方式存在、被允许做什么——由两个相互独立但协作的子系统决定。

### 场景感知（Scene Awareness）

**回答：现在是哪种时刻？**

场景感知是"软"的——它调节 Agent 的语气、距离、记忆召回倾向、主动性高低。它不是权限机制，是存在状态的调节器。

**分类维度（示例，非穷举）：**

- 话题：情感 / 职场 / 科技 / 哲学 / 历史 / 文学 / 日常
- 活动：角色扮演 / 游戏 / 创作 / 编程 / 阅读
- 氛围：轻松 / 专注 / 深夜 / 亲密 / 紧急

**运行方式：** 持续运行，不依赖明确的切换指令。通过对话内容、时间、频率等信号动态判断。详见 [`docs/designs/time-perception.md`](docs/designs/time-perception.md)。

### 能力面罩（Capability Mask）

**回答：我现在能用什么工具和数据？**

能力面罩是"硬"的——它决定一组工具、数据范围、凭证权限的绑定。同一数字生命在不同 session 或不同任务下使用不同的面罩，防止权限泄露和工具污染。

**分类维度（示例）：**

- 开发者面罩：terminal、代码读写、ACP Cursor
- 维护者面罩：FreeAnima 配置、部署、数据库
- 创作者面罩：文件读写、笔记、多媒体生成
- 研究面罩：Web 搜索、论文检索
- 角色扮演面罩：仅限对话上下文，无外部工具
- 默认面罩：基础对话 + 有限查询

**运行方式：** 在 session 边界、明确指令或场景感知触发时切换。每个面罩是一组声明的工具和数据范围，不是独立的身份。

### 两者的关系

```
场景感知（软调节）
     │  调语气、距离、记忆召回
     │
     ▼
能力面罩（硬约束）
     │  调工具集、权限、数据范围
     │
     ▼
Agent 的行为输出
```

- 场景感知判断"我们在干什么" → 自动推荐面罩切换、调节存在方式
- 能力面罩约束"我能做什么" → 防止跨场景工具误用
- 两者在最终行为中交汇，但各自独立演化

需要细化设计方案时，拆为 `docs/designs/scene-awareness.md` 和 `docs/designs/capability-masks.md`。

## 记忆分层（摘要）

| 层  | 位置                               | 职责                                           |
| --- | ---------------------------------- | ---------------------------------------------- |
| L1  | PostgreSQL `sessions` + `messages` | 原始对话存档（`sessions/*.jsonl` 仅迁移/归档） |
| L2  | `processed/*.jsonl`                | L1 蒸馏精简                                    |
| L3  | `memory/*.md`                      | 原子事实                                       |
| L4  | `index/`                           | FTS 检索（L3 优先，L2 兜底）                   |

管道：`distill → reflect → index`，由 EventBus 异步驱动。细节见 [`docs/memory.md`](docs/memory.md)。

## 凭证系统（摘要）

- pass（GPG）是凭证的唯一存储；部署环境上的 pass 仓库是运行时的一等公民资产
- LLM **永不接触凭证值**：只见 `list_credentials()` 返回的路径与元数据
- 运行时注入：`credential(path)` 仅在 `execute_code` / `terminal` 执行环境中可用
- 凭证值不写入 session JSONL、不写入日志
- 平台适配器（Discord 等）启动时从 pass 读取 token
- CLI：`anima credential {list,get,add}`

## 运行模式

生产环境：`anima service`（systemd --user；unit 由 `service start` 写入 `~/.config/systemd/user/anima.service`，2026-05-25 自 Hermes 迁入）。unit 策略：`Restart=always`（仅 `systemctl stop` 可停）、崩溃后 `RestartSec=180` 再拉起、`StartLimitIntervalSec=0` 不因连续失败放弃重启。

- **service**：持续运行 — HTTP（WebUI / 卧室 API）、Discord / 微信 Gateway、EventBus、Cron
- **chat**：单次非交互对话（CLI 或管道 stdin）
- **WebUI**：浏览器访问 `http://127.0.0.1:2658/webui/*`（Bun fullstack CSR + tRPC）

已移除（随 Python 栈退役）：Textual TUI、`print` 流水线模式。

## 工具架构（三层）

工具层是逸灵风能力的来源，分三层注册，但向 LLM 暴露为**统一的扁平的 tool list**。
LLM 不关心一个工具来自哪一层，只关心它叫什么名字、接受什么参数。

```
LLM 视角 — flat tool list:
  read_file(path)                ← 本地
  write_file(path, content)      ← 本地
  execute_code(code)             ← 本地
  query_database(sql)            ← MCP Server A
  send_email(to, subject)        ← MCP Server B
  acp_cursor(goal, context)      ← ACP 实例
  acp_booking(goal, context)     ← ACP 实例

逸灵风内部:
  Registry (flat, 按注册顺序展平)
    ├─ 本地工具   ← @tool / registry.register()
    ├─ MCP 工具   ← MCP Client 启动后批量注册
    └─ ACP 工具   ← ACP Client 启动后每个实例注册一个 tool
```

### 第一层：本地工具（Local）

本地工具写在 `packages/tools/`，通过 `registerTool()` 注册到 `@freeanima/engine-tool` 的 registry。

**特征：**

- 代码在逸灵风进程内直接执行
- 启动时 `registerAllTools()` 统一注册
- 最可靠、最低延迟

**注册方式：**

```typescript
registerTool({
  name: "read_file",
  description: "Read a text file",
  parameters: { name: "read_file", description: "...", parameters: { type: "object", ... } },
  handler: (args) => toolResult({ ok: true }),
});
```

**目录约定：** `packages/tools/src/*.ts`，由 `registerAllTools()` 导入。

### 第二层：MCP 工具（Model Context Protocol）

MCP 工具通过 MCP Client 连接外部 MCP Server，每个 Server 可以注册多个细粒度工具。

**特征：**

- 每个 MCP Server 是独立进程（stdio 或 SSE 传输）
- 每个 Server 自声明它的 tool schema 列表
- MCP Client 收集所有 Server 的 schema，批量注册到逸灵风 registry
- Server 进程由 MCP Client 管理生命周期（启动/保活/关闭）
- 工具名前缀：**无固定前缀**（MCP Server 声明的原名，如 `query_database`）
- 工具粒度：单一函数调用（如 `query_database(sql)`），非任务级

**配置方式（config.yaml）：**

```yaml
mcp_servers:
  database:
    command: npx @modelcontextprotocol/server-postgres
    args: ["--connection", "postgresql://..."]
    transport: stdio
  email:
    url: http://email-mcp-server:8080
    transport: sse
```

**注册流程：**

```
逸灵风启动 → 读取 mcp_servers 配置
         → 对每个配置启动 MCP Server（子进程 / TCP 连接）
         → 调用 servers/tools/list 获取工具列表
         → 每个工具注册到逸灵风 registry（name 保持原名）
         → LLM 调用时，MCP Client 根据 tool name 路由到正确的 Server
```

**调用流程：**

```
LLM 调 query_database(sql)
  → engine 在 registry 中查找 → tool 绑定 MCP Client
  → MCP Client 确定该 tool 属于哪个 Server
  → 通过 stdio/SSE 发送 tools/call 请求
  → 等待 Server 返回
  → 返回结果给 engine
```

### 第三层：ACP 工具（Agent Client Protocol）

ACP 工具连接外部 ACP Agent 实例，**每个实例**注册为**一个**任务级工具。

**特征：**

- 配置负责启动命令；**适配器**（`adapter: cursor` 等）负责方言（流式通知、权限、扩展 RPC），见 `integrations/src/acp/adapters/`
- 每个 ACP 实例是一个独立 Agent（子进程或远程服务）
- 每个实例只注册**一个**工具：`acp_{name}(goal, context)` → 结果
- 工具名前缀：**固定 `acp_`**，如 `acp_cursor`、`acp_booking`
- 工具粒度：完整任务委托（"分析代码库并写报告"），非单次函数调用
- ACP 实例可以有自己的记忆、身份、工具、秘密——逸灵风不关心也不感知
- 实例可以是纯工具（Cursor Agent），也可以是有自我意识的数字生命——对逸灵风无区别
- 逸灵风与 ACP 实例的关系是"雇主与承包商"，不是"主进程与子进程"

**配置方式（config.yaml）：**

```yaml
acp_agents:
  cursor:
    command: ~/.local/bin/agent
    args: ["--force", "acp"]
    name: cursor
    description: "委托编码、重构、代码审查任务"
  booking:
    url: acp://booking-agent:8080
    transport: sse
    name: booking
    description: "委托机票和酒店预订任务"
```

**注册流程：**

```
逸灵风启动 → 读取 acp_agents 配置
         → registerTools 向 registry 注册 acp_{name}
         → startAllAsync 后台连接 enabled !== false 的 agent（stdio JSON-RPC）
         → 连接超时 connect_timeout_ms（默认 15s）；prompt 超时 prompt_timeout_ms（默认 120s）
         → LLM 看到 acp_cursor(goal, context)
```

> 当前仅实现 stdio transport；配置中的 `url` / `transport: sse` 尚未接入。

**调用流程：**

```
LLM 调 acp_cursor(goal="重构 auth 模块", context="...")
  → engine 找到 acp_cursor tool，绑定 cursor ACP Client
  → 默认复用当前逸灵风 session 在 `session_meta.acp_sessions[cursor]` 的 ACP session；`new_session: true` 强制新建
  → Client 通过 ACP 协议发送任务（goal + context），同 agent 上请求串行排队
  → 等待 ACP Agent 完成（可能几分钟）
  → 返回 JSON（`session_id`、`output`、`new_session`、`reused_binding` 等）给 engine
```

### 三层对比

| 维度        | 本地工具               | MCP 工具                   | ACP 工具          |
| ----------- | ---------------------- | -------------------------- | ----------------- |
| 执行位置    | 逸灵风进程内           | 外部 Server 子进程         | 外部 Agent 子进程 |
| 粒度        | 单次函数               | 单次函数                   | 完整任务          |
| 延迟        | 毫秒级                 | 毫秒~秒级                  | 秒~分钟级         |
| 注册方式    | 自动发现               | 配置 + 协议发现            | 配置 + 固定签名   |
| 名称前缀    | 原名（由 Server 声明） | 原生 `mcp_{server}_{tool}` | 固定 `acp_`       |
| 实例/工具比 | 1:1                    | 1:N                        | 1:1               |
| 独立身份？  | 否                     | 否                         | 可（透明）        |
| 生命周期    | 逸灵风启动/关闭        | Client 管理                | Client 管理       |

### 混合场景

三层不是互斥的。一个场景可以同时使用多层：

```
LLM 分析数据库异常:
  1. acp_cursor("检查 users 表的相关代码")     ← ACP：让 Cursor 分析代码
  2. query_database("SELECT * FROM users ...") ← MCP：查数据库
  3. write_file("analysis.md", content)        ← 本地：写结果到文件
```

LLM 自己决定用什么工具、什么顺序。逸灵风只负责注册和路由。

## WebUI 架构

WebUI 是 React 19 CSR 应用（`apps/webui/`），由 `anima service` 在同一 HTTP 端口（默认 **2658**）提供页面与 tRPC API。

### 服务拓扑

```
浏览器 ──HTTP/SSE/WS──→ node:http（2658，API + WS 升级）
                              │
                              ├─ /api/trpc/*（HTTP batch + SSE subscription）
                              ├─ /api/trpc/ws（终端 WebSocket）
                              ├─ /api/health
                              ├─ /webui/*、/_bun/* → 内嵌 Bun fullstack dev（HTML/TSX/CSS HMR）
                              └─ tRPC router → NestService（进程内）
                         NestService / EventBus / Gateway（同进程）
```

### 前端三态

同一 SPA 内三个独立态，可切换，不共享布局与本地状态：

| 态     | 路由前缀           | 角色                                                  |
| ------ | ------------------ | ----------------------------------------------------- |
| 会客厅 | `/webui/parlor/*`  | 与 Agent 对话                                         |
| 卧室   | `/webui/chamber/*` | 记忆、配置、工具与系统维护（旧 `/workshop` 重定向）   |
| 创作室 | `/webui/studio/*`  | 协同工作台：结对编程（占位）、长篇/短视频（即将推出） |

### API 层

| 机制      | 说明                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| tRPC      | 主要 JSON API（会话、状态、记忆、MCP/ACP、studio 等）；聊天流用 SSE subscription |
| REST      | `GET /api/health`（CLI 探针）                                                    |
| WebSocket | `WS /api/trpc/ws`（创作室 xterm `studio.terminal.*`）                            |

### 启动

```bash
anima service start              # systemd --user（默认）
anima service start --foreground # 本地调试（Bun fullstack HMR）
anima service status
# 浏览器访问 http://127.0.0.1:2658/webui/parlor/chat
```

WebUI 由 [`packages/server/src/webui-server.ts`](packages/server/src/webui-server.ts) 在 `serve()` 内启动：对外 `node:http`，内嵌 Bun fullstack 编译 `apps/webui/index.html`（Tailwind 依赖根 `bunfig.toml` 的 `bun-plugin-tailwind`）。

## 事件系统

### EventBus（已有）

**异步 after-the-fact 通知模式。** 组件不直接调用对方，而是发射事件，由注册的处理器链处理。

```
conversation.py  emit("session:updated")
  └─ handlers: distill → reflect（按注册顺序执行）
               每个 handler 处理完后可发射下游事件
               distill 成功 → emit("l2:updated") → index_l2_fts
               reflect 写事实 → emit("l3:updated") → index_l3_fts
```

特征：

- 同步写入 SQLite 表（微秒级），后台线程轮询执行
- 处理器链在同一次轮询中顺序执行，前一个失败则中断链
- 失败重试（最多 3 次），不会丢失事件
- 用于**发生后该做什么**的场景：蒸馏、反射、索引

### Hooks（`@freeanima/kernel-hooks`）

**同步 interceptor 模式。** 注册表在 `@freeanima/kernel-hooks`：`run(context)` 返回 `HookRunResult`（`context` 只读、`chain` 经 `prev` 串联；聚合 `blocked` / `blockedMessage`）。领域 **context 类型** 在 [`kernel/hooks/src/domain-hooks.ts`](kernel/hooks/src/domain-hooks.ts)；`kernel` 单例见 [`service/bootstrap/src/kernel.ts`](service/bootstrap/src/kernel.ts)。

语义要点：

- handler 返回 `{ status, blocked?: boolean, message?, data? }`；**不**原地改 context；业务日志在 handler 注册处自行记录。
- **短路**：仅 `status: "ok"` 且 `blocked === true`；原因写在 `message`，聚合为 `HookRunResult.blockedMessage`。
- **`status: "failed"`**：入链但**不**挡后续 handler；`run()` **不** throw。
- 调用方读 `run.blocked` / `run.blockedMessage`；效应用 `headOkStepData(run.chain)`（链头方向第一个 ok 步的 `data`，多 handler 时以最后执行的为准）。

已接入点（hook token）：

- `messageIncoming` — `NestService` 入站
- `turnAfterComplete` — 单轮结束
- `toolAfterCall` — 工具返回后

`@freeanima/capabilities-clarify` 在 `serve()` 里通过 `registerClarifyHooks(kernel)` 挂载 handler。

与 EventBus 的关系：

| 维度         | EventBus                       | Hooks                                                       |
| ------------ | ------------------------------ | ----------------------------------------------------------- |
| 时序         | 发生后                         | 发生前/中/后                                                |
| 调用方式     | 异步（轮询）                   | 同步（`await kernel.hookRegistry.run`）                     |
| 能否修改数据 | 不能                           | 经 `data` 返回效应，由 fold 合并                            |
| 错误语义     | 链中断                         | failed 步可继续；`ok`+`blocked` 短路                        |
| 实现状态     | ✅ `registerMemoryPipeline` 等 | ✅ `@freeanima/kernel-hooks` + `@freeanima/service-logging` |

记忆管道入口为 `registerMemoryPipeline`（`@freeanima/legacy-memory`）；`registerMemoryHandlers` 为兼容别名。Hooks 不是 EventBus 的替代品，两者互补。

## 版本与发布

- 版本号遵循 **SemVer 2.0.0**；根 `package.json` 的 `version` 为写入源。
- 发版流程：根 `package.json` 的 `version` + `CHANGELOG.md` 由 **semantic-release** 在 merge `main` 后自动更新（见 [docs/versioning.md](docs/versioning.md)）。
- bump 规则与逐步命令见 [`docs/versioning.md`](docs/versioning.md)。

## 方向

阶段性能力规划，**不是执行清单**。具体任务见 `TODOS.md`。

- 技能 / 插件系统
- 笔记资产纳入 L4 检索（范围待讨论）
- 安全 P0 项落地（read deny、shell 策略）— 见 [`docs/security.md`](docs/security.md)
- docgen：从 registry 自动生成工具表（低优）
- WebUI 多行粘贴优化（长文本 → 临时文件链接）
- 扩展更多 Hook 点（见上文「Hooks」）

## 约束

- 原则与结构写在本文件；不写具体待办
- 会周变的实现细节以代码为准；长期专题进 `docs/*.md`（见 `AGENTS.md` 文档地图）
- 当前要做的事只进 `TODOS.md`；**完成后从 TODOS 删除**，不保留已完成项
- 用户可见的发布级变更进 `CHANGELOG.md`（发版时）

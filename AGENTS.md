# 逸灵风 — Agent 启动协议

> 面向在本仓库工作的 AI Agent（Cursor、Copilot 等）。
> 数字生命定位见 [`docs/identity.md`](docs/identity.md)；自我层见 [`docs/self-layer.md`](docs/self-layer.md)。

## 全局视角

`freeanima`（逸灵风）是 **TypeScript 单栈** Agent 运行时：`anima service` 启动 Bun 服务（WebUI + tRPC + Gateway + 引擎）。

| 能力     | 要点                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 记忆     | L1 对话（PG）→ L2 蒸馏 → L3 事实 → L4 检索；见 [`docs/memory.md`](docs/memory.md)                                                                                            |
| 工具     | 本地 / MCP / ACP 扁平注册；实现于 `capabilities/tools/`、`capabilities/mcp/`、`capabilities/acp/`                                                                            |
| 凭证     | pass GPG；运行时注入；LLM **只见路径不见值**                                                                                                                                 |
| 数据目录 | `~/.anima/`（`FREEANIMA_HOME` 可覆盖）；备份打包此目录即可                                                                                                                   |
| 代码布局 | `kernel/`、`engine/`、`life/`、`capabilities/`、`connectors/`、`service/`、`cli/`；详图见 [`docs/designs/issue-1-migration-plan.md`](docs/designs/issue-1-migration-plan.md) |

**细节以代码为准**；勿凭文档臆造工具名、端点或目录。需要时直接读源码或 `grep`。

---

## 启动顺序

1. [`TODOS.md`](TODOS.md) — 当前任务，最高优先级
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — 改架构 / 记忆 / 凭证前必读
3. 按任务展开 `docs/` 专题（见下方文档地图）

---

## 硬性约束

### 代码与测试

- 类型注解全覆盖
- 工具返回：**成功与失败均为 JSON 字符串**；错误格式 `{"error": "..."}`
- 安全路径以代码为准（写保护、设备阻塞、二进制过滤）
- 新功能须补测试（最小可用）；mock 外部依赖；真实 LLM / 外网用例默认不进 CI
- **import 相对路径须带 `.ts` / `.tsx` 后缀**（oxlint `import/extensions`）
- 集成测须隔离日志：`tests/helpers/integration-case.ts`（`restoreIntegrationHome` + `flushCompressionSummaries`），勿污染 `~/.anima/error.log`

### 包命名（RFC #1）

新栈 workspace 包名 **以层名为首段前缀**：

| 形态     | 模式                               | 示例                                            |
| -------- | ---------------------------------- | ----------------------------------------------- |
| 层聚合   | `@freeanima/{layer}`               | `kernel`、`engine`                              |
| 层内组件 | `@freeanima/{layer}-{slug}`        | `kernel-eventbus`、`engine-tool`、`service-api` |
| 层内实现 | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-sqlite`                    |

- slug 合成词不加内连字符（`eventbus` 非 `event-bus`）
- Hook / EventTopic 的 `qualifiedId` 与 npm 包名独立

### 代码层与依赖

> 此处是**代码仓库**分层（与 [`ARCHITECTURE.md`](ARCHITECTURE.md) 中的认知四层 Consciousness/Self/Memory/Estate 不同）。依赖边界由 [`scripts/check-layer-deps.ts`](scripts/check-layer-deps.ts) 强制检查。

#### 分层依据

| 层               | 职责（划分依据）                                                                   | 典型包                                                            |
| ---------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **kernel**       | 与业务无关的运行时基建：Hook、EventBus、日志、跨层共用纯类型/工具                  | `kernel-hooks`、`kernel-eventbus`、`kernel-logging`               |
| **engine**       | Agent **机制**：对话、LLM 循环、工具注册、压缩、仓储端口、PG schema 真源           | `engine-conversation`、`engine-loop`、`engine-repos`、`engine-db` |
| **life**         | 数字生命的**持续性与记忆管道**（L2/L3/reflect/index），只通过端口读 L1             | `life-memory`、`life-self`                                        |
| **capabilities** | 可插拔**能力包**（本地工具、MCP/ACP、clarify、LLM provider），不含组合与 I/O 装配  | `capabilities-tools`、`capabilities-mcp`                          |
| **connectors**   | **外部世界适配**：Gateway、WebUI、Cron、PG 实现、命令注册                          | `connectors-db-pg`、`connectors-gateway`                          |
| **service**      | **组合根**：创建 Kernel/Engine/Conversation/AnimaService，注入上下文，对外进程入口 | `service`、`service-bootstrap`                                    |

依赖方向：`service` 装配各层 → `connectors` 实现端口 → `engine` / `life` / `capabilities` 消费端口与机制 → `kernel` 提供基建。

#### 允许依赖（与 dep-check 一致）

| 层               | 允许 `@freeanima/*`                                                                                           | 禁止（要点）                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **kernel**       | `kernel-*`、`kernel`                                                                                          | `engine-*`、`service`                       |
| **engine**       | `kernel-*`、`engine-*`、`service-config`、`service-logging`、`capabilities-provider-*`                        | `connectors-db-pg`（PG 实现不得渗入机制层） |
| **life**         | `kernel-*`、`life-*`、`engine-tool`、`engine-repos`、`connectors-sqlite`、`service-config`、`service-logging` | `engine-db`、`connectors-db-pg`             |
| **capabilities** | `kernel-*`、`engine-*`、`capabilities-*`、`life-memory`（按需）、`service-config`、`service-logging`          | `service`                                   |
| **connectors**   | 各层（实现层，可调用 service 上下文）                                                                         | —                                           |
| **service**      | 各层（组合根）                                                                                                | —                                           |

#### 组合根与全局单例

[`service/service/src/serve.ts`](service/service/src/serve.ts) 是唯一装配 PG 与运行时上下文的入口：

```
createServiceKernel()
→ createEngine({ repos: createPgRepositories | nullPgRepositories })
→ createConversationService(engine.repos)
→ new AnimaService({ kernel, conversation })
→ initServiceContext({ kernel, engine, conversation, service, ... })
```

**禁止：**

- `bindKernel` / `getKernel` / `Kernel.repos` 等内层全局单例
- 在 engine/life 内直接 `new` PG 连接或 import `connectors-db-pg`

**允许：**

- **`ConversationService`**：在 service 组合根实例化；运行时经 `getServiceContext().conversation`，或**显式参数**向下传递
- **`SessionStorePort`**：life 记忆管道经 `registerMemoryPipeline({ sessionStore })` 注入
- **工具上下文**：`runWithToolContext(sessionId, fn, { repos })` + `getToolRepos()`（见 `engine/loop/src/tool-context.ts`）

### 类型归属

Agent 新增或移动类型 / Zod / 端口时，按下列顺序决策：

1. **PG 存储形状（DDL + JSONB Zod）** → `@freeanima/engine-db`（唯一真源 SSOT）
2. **仓储端口与聚合** → `@freeanima/engine-repos`（`*StorePort`、`PgRepositories`；含 `null*` 适配器）
3. **领域类型** → **谁消费谁拥有**（该层的 `{layer}-{slug}` 包内）；仅当多域共用时才上浮到 kernel 纯类型包

补充原则：

- 领域视图可 `import type` / `z.infer` 自 `engine-db`，但**不得复制** storage Zod 定义
- **HTTP/WebUI 契约**在 `connectors-webui/api` 或 `service-api`；**进程内快照/展示**归 service
- **EventBus payload** 归事件**发布方所在域**（记忆事件 → life-memory）

#### 类型归属表

| 内容                                                          | 包                           | 路径 / 说明                                     |
| ------------------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| L1 message / session_meta 存储 Zod                            | `engine-db/schema`           | JSONB 与 payload 真源                           |
| L1 领域便利类型（`SessionMessage`、`ConversationMessage` 等） | `engine-db/domain`           | 自 schema 派生；`engine-conversation` re-export |
| `SessionStorePort` / `PgRepositories`                         | `engine-repos`               | 仓储端口                                        |
| L2 行 / fact 提取 schema                                      | `life-memory/schemas`        | `l2.ts`、`fact.ts`                              |
| EventBus payload Zod（`session:updated` 等）                  | `life-memory/schemas`        | `event-payloads.ts`；topic token 见 `events.ts` |
| `cron_jobs` PG schema（DDL）                                  | `engine-db/migrations`       | SQL migration                                   |
| Cron job API 校验 schema                                      | `connectors-cron`            | `schema.ts`                                     |
| `CronJobStorePort`                                            | `engine-repos`               | `ports/cron.ts`                                 |
| `self_blocks` DDL + `selfBlockKeySchema`                      | `engine-db/schema`           | `self-layer.ts`                                 |
| `SelfLayerStorePort` / `SelfBlockRow`                         | `engine-repos`               | `ports/self-layer.ts`                           |
| 六块 prompt 视图（`SELF_BLOCK_HEADINGS` 等）                  | `life-self`                  | `blocks.ts`、`compose.ts`                       |
| `autobiographical_memory` DDL + significance/status Zod       | `engine-db/schema`           | `autobiographical-memory.ts`                    |
| `AutobiographicalMemoryStorePort`                             | `engine-repos`               | `ports/autobiographical-memory.ts`              |
| 自传 cron 编排 / 工具                                         | `life-memory`                | `autobiography/`、`autobiographical-tools.ts`   |
| WebUI 展示视图（`MessagesDisplay`）                           | `service/schemas`            | `display.ts`                                    |
| AnimaService 内部快照（`ServiceSnapshot` 等）                 | `service/schemas`            | `snapshot.ts`                                   |
| 微信网关持久化 schema                                         | `connectors-gateway/schemas` | `weixin.ts`                                     |
| JSON safeParse 工具                                           | `kernel-util`                | `parseJsonLine`、`safeParseOrNull` 等           |

新增 PG 域：`engine-db/schema/{domain}` → `engine-repos` 增端口 → `connectors-db-pg` 实现 → `PgRepositories` 扩展 → `serve.ts` 装配。详见 [`docs/database.md`](docs/database.md)。

### 安全与连续性

- 凭证、密钥不写入 git / 日志 / 工具返回值
- 记忆与自我层改动需格外谨慎（见 [`docs/identity.md`](docs/identity.md)）
- 连续性高于功能堆砌；简单基建自写，复杂逻辑用成熟三方库

---

## 常用命令

```bash
bun install && bun run check       # 推 PR 前：typecheck + lint + format + 测试
bun run test:changed               # 本地 / pre-commit
bun run service start --foreground # 前台 dev（WebUI HMR）
anima credential list              # 凭证路径；值在 pass
```

- WebUI 会客厅：`http://127.0.0.1:2658/webui/parlor/chat`
- 发版与 commit 规范：[`docs/versioning.md`](docs/versioning.md)
- PG 迁移：[`docs/database.md`](docs/database.md)

---

## 文档地图

| 文件                                   | 职责                       |
| -------------------------------------- | -------------------------- |
| [`AGENTS.md`](AGENTS.md)               | 本文件：启动协议与硬性约束 |
| [`TODOS.md`](TODOS.md)                 | 当前可执行任务             |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)   | 架构原则与方向             |
| [`docs/memory.md`](docs/memory.md)     | 记忆管道                   |
| [`docs/database.md`](docs/database.md) | PostgreSQL schema          |
| [`docs/security.md`](docs/security.md) | 安全与凭证                 |
| [`docs/identity.md`](docs/identity.md) | 数字生命 / SOUL            |
| [`docs/designs/`](docs/designs/)       | 专题设计（含 RFC 迁移）    |

---

## 冲突优先级

1. **代码实现** > 一切文档
2. **ARCHITECTURE.md** > 专题 `docs/*.md`
3. **TODOS.md** > ARCHITECTURE 方向规划

## 改代码须同步的文档

| 变更类型                   | 更新                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------ |
| L1 / PG schema             | [`docs/database.md`](docs/database.md)                                               |
| 层依赖 / 组合根 / 类型归属 | 本文件（代码层与依赖、类型归属）+ [`docs/database.md`](docs/database.md) PG 包表     |
| 记忆管道 / 检索            | [`docs/memory.md`](docs/memory.md) + ARCHITECTURE                                    |
| 安全 / 威胁面              | [`docs/security.md`](docs/security.md) + ARCHITECTURE                                |
| 架构原则                   | ARCHITECTURE.md                                                                      |
| 新建 RFC 包 / rename       | 本文件命名表 + [`issue-1-migration-plan.md`](docs/designs/issue-1-migration-plan.md) |
| 发版                       | [`docs/versioning.md`](docs/versioning.md)                                           |
| 任务完成                   | 从 TODOS 删除；用户可见变更用 Conventional Commits                                   |

工具表、模块树、API 列表**不维护在文档中**——以注册代码与服务 router 为准。

## 维护规约

- 原则变更先 ARCHITECTURE，再决定是否写专题 doc
- 新专题 >50 行且长期有效才进 `docs/`，否则进 TODOS
- 任务完成从 TODOS 删除，不保留已完成项

## 各文件禁止写什么

| 文件                | 禁止                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| AGENTS.md（本文件） | 完整工具表、目录树、API 对照、SemVer 细则（**须**维护代码层与依赖、类型归属表） |
| ARCHITECTURE.md     | 具体待办、会周变工具清单                                                        |
| TODOS.md            | 已完成项、架构长篇                                                              |

# 逸灵风 — Agent 启动协议

> 面向在本仓库工作的 AI Agent（Cursor、Copilot 等）。
> 数字生命定位见 [`docs/identity.md`](docs/identity.md)；自我层见 [`docs/self-layer.md`](docs/self-layer.md)。

## 全局视角

`freeanima`（逸灵风）是 **TypeScript 单栈** Agent 运行时：`anima service` 启动 Bun 服务（WebUI + tRPC + Gateway + 引擎）。

| 能力     | 要点                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 记忆     | 对话存档（PG）→ 浅睡提取 → `semantic_memory` → PG FTS 检索；见 [`docs/memory.md`](docs/memory.md)                                                                            |
| 工具     | 本地 / MCP / ACP 扁平注册；实现于 `capabilities/tools/`、`capabilities/mcp/`、`capabilities/acp/`                                                                            |
| 凭证     | pass GPG；运行时注入；LLM **只见路径不见值**                                                                                                                                 |
| 数据目录 | `~/.anima/`（`FREEANIMA_HOME` 可覆盖）；备份打包此目录即可                                                                                                                   |
| 代码布局 | `kernel/`、`engine/`、`life/`、`capabilities/`、`connectors/`、`service/`、`cli/`；详图见 [`docs/designs/issue-1-migration-plan.md`](docs/designs/issue-1-migration-plan.md) |

**细节以代码为准**；勿凭文档臆造工具名、端点或目录。需要时直接读源码或 `grep`。

---

## 启动顺序

1. [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) — 可执行任务与讨论项
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — 改架构 / 记忆 / 凭证前必读
3. 按任务展开 `docs/` 专题（见下方文档地图）

---

## 硬性约束

### 代码与测试

- 类型注解全覆盖
- 工具返回：**失败一律 `toolError(msg)`（JSON `{"error":"..."}`）**；成功分两类——结构化工具用 `toolResult(obj)`，LLM 可读工具（如 `file_read_file` / `terminal_run` / `code_execute`）允许纯文本 stdout。
- 安全路径以代码为准（写保护、设备阻塞、二进制过滤）
- 新功能须补测试（最小可用）；mock 外部依赖；真实 LLM / 外网用例默认不进 CI
- **import 相对路径须带 `.ts` / `.tsx` 后缀**（oxlint `import/extensions`）
- 集成测须隔离日志：`tests/helpers/integration-case.ts`（`restoreIntegrationHome` + `flushCompressionSummaries`），勿污染 `~/.anima/error.log`

#### 测试分层（硬性）

| 层级         | 位置                                             | 允许                                          | 禁止                                                                            |
| ------------ | ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------- |
| **单元测试** | `{layer}/{pkg}/src/**/*.test.ts`（**一律旁置**） | `mock` / `spyOn` / 原包 Tier 1–2 导出（见下） | PG、真实 Redis、文件读写、`FREEANIMA_HOME` 隔离、`tests/helpers/`、Docker、外网 |
| **跨包集成** | `tests/integration/`                             | PG、Redis、临时目录、`beginIntegrationCase`   | —                                                                               |
| **E2E**      | `tests/e2e/`                                     | WebView + Chromium + PG + HTTP                | —                                                                               |

- pre-commit：`bun run test:changed`（**仅单元** changed）；推 PR 前须 `bun run test` 全量（单元 + 集成 + E2E 并行，`--changed` 不保证跨包关联）。
- 单包逻辑 → 旁置单元测；多包协作或真实持久化 → `tests/integration/`。

#### 原包 Mock 导出（单元测优先使用）

| 层级              | 包                                                                                       | 用法                                                       |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Tier 1 内存适配器 | `kernel-logging/null`、`/memory`；`kernel-eventbus/memory`、`/null`；`engine-repos/null` | `createNullSink`、`MemoryEventQueue`、`nullPgRepositories` |
| Tier 2 单例注入   | `connectors-redis`、`connectors-db-pg`、`service-config` 等                              | `setXForTest` / `resetXForTest`；`afterEach` 必须 reset    |
| Tier 3 组合工厂   | 可选 `@freeanima/{pkg}/testing`                                                          | 仅组合 Tier 1，如 `createTestLogger`                       |
| 领域 mock         | `{pkg}/src/test-helpers/`                                                                | 原包无 port 时（如 `MockBackend`）                         |

单元测**禁止** `import` `tests/helpers/log-isolation.ts` 或写 `config.yaml`；配置用 `setConfigForTest`，日志用 `createNullSink` / `createMemorySink`。

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
| **life**         | 数字生命的**持续性与记忆管道**（语义/情景记忆、浅睡/深睡），只通过端口读对话存档   | `life-memory`、`life-self`                                        |
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
→ catalog = createEngineCatalog(); masks = new MaskRegistry()
→ registerServiceTools(catalog); initMaskSystem(masks)
→ createEngine({ catalog, repos, llm })
→ createConversationService(engine.repos, catalog.toolSets)
→ new AnimaService({ kernel, conversation })
→ initServiceContext({ engine, masks, service, conversation, ... })
```

#### Runtime Catalog（Registry 实例）

**实例获取原则**：要拿到 `ToolSetRegistry` / `SkillRegistry` / `MaskRegistry` 等 catalog 实例，**要么 `new` 一个，要么从上下文（或自上下文派生的显式参数）获取**。

| 场景                                              | 做法                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 组合根 [`serve.ts`](service/service/src/serve.ts) | `new` 各 Registry，装入 `Engine.catalog` 与 `ServiceContext.masks`                                                                        |
| 运行时读写                                        | `getServiceContext().engine.catalog.*`、`getServiceContext().masks`；turn 内经 `runWithToolContext(..., { tools })` / `getToolRegistry()` |
| 向下传递                                          | 显式参数（如 `registerCoreTools(toolSets)`）合法，**参数须来自组合根 `new` 或 context**，不得读模块 default                               |
| 单元测                                            | `new ToolSetRegistry()` 等隔离实例；禁止污染进程级 catalog                                                                                |

**归属**（层边界）：

- `Engine.catalog`：`toolSets`、`skills`（engine 层）；`ToolSetRegistry` 内嵌 `ToolDef[]`，flat API（`getTool` / `listTools` / `openaiSchemas`）在 `toolSets` 实例上
- `Engine.tools`：只读 getter，指向 `catalog.toolSets`（兼容旧调用方）
- `ServiceContext.masks`：`MaskRegistry`（capabilities 层；engine 不可 import `capabilities-mask`）

**禁止**：

- `export const default*Registry` 及依赖它的模块级 `registerTool()` / `listTools()` / `registerMask()` 等（import 时隐式绑定，不可注入）
- capabilities / life / engine 内 `import { defaultToolRegistry }` 等直接读 default
- `ToolDef.toolset` 字段；工具归属由所在 ToolSet 决定；MCP/ACP 动态集用 `registerToolSet` / `unregisterToolSet` 配对（不用 upsert）

**允许**：与 `ConversationService`、`SessionStorePort` 相同——组合根实例化，运行时经 `getServiceContext()` 或显式参数传递。

**禁止：**

- `bindKernel` / `getKernel` / `Kernel.repos` 等内层全局单例
- 在 engine/life 内直接 `new` PG 连接或 import `connectors-db-pg`

**允许：**

- **`ConversationService`**：在 service 组合根实例化；运行时经 `getServiceContext().conversation`，或**显式参数**向下传递
- **`SessionStorePort`**：life 记忆管道经 `registerMemoryPipeline({ sessionStore })` 注入
- **工具上下文**：`runWithToolContext(sessionId, fn, { repos, tools })` + `getToolRepos()` / `getToolRegistry()`（见 `engine/loop/src/tool-context.ts`）

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

| 内容                                                               | 包                           | 路径 / 说明                                     |
| ------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------- |
| Slice A message / session_meta 存储 Zod                            | `engine-db/schema`           | JSONB 与 payload 真源                           |
| Slice A 领域便利类型（`SessionMessage`、`ConversationMessage` 等） | `engine-db/domain`           | 自 schema 派生；`engine-conversation` re-export |
| `SessionStorePort` / `PgRepositories`                              | `engine-repos`               | 仓储端口                                        |
| 浅睡 fact 提取 schema                                              | `life-memory/schemas`        | `fact-extraction.ts`、`fact.ts`                 |
| EventBus payload Zod（`session:updated` 等）                       | `life-memory/schemas`        | `event-payloads.ts`；topic token 见 `events.ts` |
| `cron_jobs` PG schema（DDL）                                       | `engine-db/migrations`       | SQL migration                                   |
| Cron job API 校验 schema                                           | `connectors-cron`            | `schema.ts`                                     |
| `CronJobStorePort`                                                 | `engine-repos`               | `ports/cron.ts`                                 |
| `tasks` DDL + status/priority Zod                                  | `engine-db/schema`           | `tasks.ts`                                      |
| `TaskStorePort` / `TaskRow`                                        | `engine-repos`               | `ports/task.ts`                                 |
| 待办工具 + 冰箱贴摘要桥接                                          | `capabilities-tasks`         | `tool.ts`、`fridge-bridge.ts`                   |
| `self_blocks` DDL + `selfBlockKeySchema`                           | `engine-db/schema`           | `self-layer.ts`                                 |
| `SelfLayerStorePort` / `SelfBlockRow`                              | `engine-repos`               | `ports/self-layer.ts`                           |
| 六块 prompt 视图（`SELF_BLOCK_HEADINGS` 等）                       | `life-self`                  | `blocks.ts`、`compose.ts`                       |
| `autobiographical_memory` DDL + significance/status Zod            | `engine-db/schema`           | `autobiographical-memory.ts`                    |
| `AutobiographicalMemoryStorePort`                                  | `engine-repos`               | `ports/autobiographical-memory.ts`              |
| 自传 cron 编排 / 工具                                              | `life-memory`                | `autobiography/`、`autobiographical-tools.ts`   |
| `limbic_memory` DDL + `limbicKindSchema`                           | `engine-db/schema`           | `limbic-memory.ts`                              |
| `LimbicMemoryStorePort`                                            | `engine-repos`               | `ports/limbic-memory.ts`                        |
| 浅睡 Phase 2 / `create_limbic_memory`                              | `life-memory`                | `limbic-tools.ts`、`light-sleep/run.ts`         |
| 能力面罩（`Mask` / `ResolvedMask` / 注册表）                       | `capabilities-mask`          | `types.ts`、`registry.ts`、`resolve.ts`         |
| Session `capability_mask` 存储形状                                 | `engine-db/schema`           | `jsonb/capability-mask.ts`                      |
| WebUI 展示视图（`MessagesDisplay`）                                | `service/schemas`            | `display.ts`                                    |
| AnimaService 内部快照（`ServiceSnapshot` 等）                      | `service/schemas`            | `snapshot.ts`                                   |
| 微信网关持久化 schema                                              | `connectors-gateway/schemas` | `weixin.ts`                                     |
| JSON safeParse 工具                                                | `kernel-util`                | `parseJsonFile`、`safeParseOrNull` 等           |

新增 PG 域：`engine-db/schema/{domain}` → `engine-repos` 增端口 → `connectors-db-pg` 实现 → `PgRepositories` 扩展 → `serve.ts` 装配。详见 [`docs/database.md`](docs/database.md)。

#### PG Schema 迁移（硬性）

**流程**：改 `engine/db/src/schema/` → **`drizzle-kit generate`** → **`migrate`**。

| 步骤 | 命令 / 动作                                                        | 产出                                                         |
| ---- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1    | 改 Drizzle schema（`engine/db/src/schema/`）                       | TypeScript 真源                                              |
| 2    | `DATABASE_URL=… bun run --filter @freeanima/engine-db db:generate` | `migrations/{ts}_{name}/migration.sql` + **`snapshot.json`** |
| 3    | `DATABASE_URL=… bun run --filter @freeanima/engine-db db:migrate`  | PG 应用 DDL；生产亦可在 `anima service` 启动时自动 migrate   |

**禁止**：

- **跳过 `generate`、仅手写 `migration.sql`**（缺 `snapshot.json` 会断 Drizzle snapshot 链，下次 `generate` 可能重复建表）
- **已应用的 migration 目录内改 SQL / 删 snapshot**（须新 migration 修正）

**允许**：`generate` 之后，在当次 `migration.sql` 中**追加** Drizzle 表达不了的 SQL（如 `CREATE EXTENSION`、`message_fts_input()`、部分 GIN 表达式索引）；**勿**以此替代整个 generate 步骤。

### 安全与连续性

- 凭证、密钥不写入 git / 日志 / 工具返回值
- 记忆与自我层改动需格外谨慎（见 [`docs/identity.md`](docs/identity.md)）
- 连续性高于功能堆砌；简单基建自写，复杂逻辑用成熟三方库

---

## 常用命令

```bash
bun install && bun run check       # 推 PR 前：typecheck + lint + format + 测试
bun run test:changed               # 本地 / pre-commit（仅单元 changed）
bun run test:unit                  # 单元全量
bun run test:integration           # 集成（tests/integration/）
bun run test                       # 单元 + 集成 + E2E 并行
bun run service start --foreground # 前台 dev（WebUI HMR）
anima credential list              # 凭证路径；值在 pass

# PG schema 变更（须 generate 产出 snapshot.json，见上文「PG Schema 迁移」）
DATABASE_URL="…" bun run --filter @freeanima/engine-db db:generate
DATABASE_URL="…" bun run --filter @freeanima/engine-db db:migrate
```

- WebUI 会客厅：`http://127.0.0.1:2658/webui/parlor/chat`
- 发版与 commit 规范：[`docs/versioning.md`](docs/versioning.md)
- PG 迁移：[`docs/database.md`](docs/database.md)

---

## 文档地图

| 文件                                                               | 职责                       |
| ------------------------------------------------------------------ | -------------------------- |
| [`AGENTS.md`](AGENTS.md)                                           | 本文件：启动协议与硬性约束 |
| [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) | 可执行任务与讨论项         |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                               | 架构原则与方向             |
| [`docs/memory.md`](docs/memory.md)                                 | 记忆管道                   |
| [`docs/database.md`](docs/database.md)                             | PostgreSQL schema          |
| [`docs/security.md`](docs/security.md)                             | 安全与凭证                 |
| [`docs/identity.md`](docs/identity.md)                             | 数字生命 / 自我层          |
| [`docs/designs/`](docs/designs/)                                   | 专题设计（含 RFC 迁移）    |

---

## 冲突优先级

1. **代码实现** > 一切文档
2. **ARCHITECTURE.md** > 专题 `docs/*.md`
3. **GitHub Issues** > ARCHITECTURE 方向规划

## 改代码须同步的文档

| 变更类型                   | 更新                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Slice A / PG schema        | [`docs/database.md`](docs/database.md)                                               |
| 层依赖 / 组合根 / 类型归属 | 本文件（代码层与依赖、类型归属）+ [`docs/database.md`](docs/database.md) PG 包表     |
| 记忆管道 / 检索            | [`docs/memory.md`](docs/memory.md) + ARCHITECTURE                                    |
| 安全 / 威胁面              | [`docs/security.md`](docs/security.md) + ARCHITECTURE                                |
| 架构原则                   | ARCHITECTURE.md                                                                      |
| 新建 RFC 包 / rename       | 本文件命名表 + [`issue-1-migration-plan.md`](docs/designs/issue-1-migration-plan.md) |
| 发版                       | [`docs/versioning.md`](docs/versioning.md)                                           |
| 任务完成                   | close 对应 GitHub Issue；用户可见变更用 Conventional Commits                         |

工具表、模块树、API 列表**不维护在文档中**——以注册代码与服务 router 为准。

## 维护规约

- 原则变更先 ARCHITECTURE，再决定是否写专题 doc
- 新专题 >50 行且长期有效才进 `docs/`；可执行任务与讨论项开 GitHub Issue
- 任务完成 close 对应 Issue，不保留已完成项在文档中

## 各文件禁止写什么

| 文件                | 禁止                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| AGENTS.md（本文件） | 完整工具表、目录树、API 对照、SemVer 细则（**须**维护代码层与依赖、类型归属表） |
| ARCHITECTURE.md     | 具体待办、会周变工具清单                                                        |

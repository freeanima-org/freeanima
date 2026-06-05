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

| 形态     | 模式                               | 示例                             |
| -------- | ---------------------------------- | -------------------------------- |
| 层聚合   | `@freeanima/{layer}`               | `kernel`、`engine`               |
| 层内组件 | `@freeanima/{layer}-{slug}`        | `kernel-eventbus`、`engine-tool` |
| 层内实现 | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-sqlite`     |

- slug 合成词不加内连字符（`eventbus` 非 `event-bus`）
- Hook / EventTopic 的 `qualifiedId` 与 npm 包名独立

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

| 变更类型             | 更新                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| L1 / PG schema       | [`docs/database.md`](docs/database.md)                                               |
| 记忆管道 / 检索      | [`docs/memory.md`](docs/memory.md) + ARCHITECTURE                                    |
| 安全 / 威胁面        | [`docs/security.md`](docs/security.md) + ARCHITECTURE                                |
| 架构原则             | ARCHITECTURE.md                                                                      |
| 新建 RFC 包 / rename | 本文件命名表 + [`issue-1-migration-plan.md`](docs/designs/issue-1-migration-plan.md) |
| 发版                 | [`docs/versioning.md`](docs/versioning.md)                                           |
| 任务完成             | 从 TODOS 删除；用户可见变更用 Conventional Commits                                   |

工具表、模块树、API 列表**不维护在文档中**——以注册代码与服务 router 为准。

## 维护规约

- 原则变更先 ARCHITECTURE，再决定是否写专题 doc
- 新专题 >50 行且长期有效才进 `docs/`，否则进 TODOS
- 任务完成从 TODOS 删除，不保留已完成项

## 各文件禁止写什么

| 文件                | 禁止                                      |
| ------------------- | ----------------------------------------- |
| AGENTS.md（本文件） | 完整工具表、目录树、API 对照、SemVer 细则 |
| ARCHITECTURE.md     | 具体待办、会周变工具清单                  |
| TODOS.md            | 已完成项、架构长篇                        |

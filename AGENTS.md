# 逸灵风 — Agent 启动协议

> 面向在本仓库工作的 AI Agent（Cursor、Copilot 等）。
> 数字生命定位见 [`docs/identity.md`](docs/identity.md)；自我层见 [`docs/self-layer.md`](docs/self-layer.md)。

## 项目概述

`freeanima`（逸灵风）是一套 Agent 运行时基础设施：工具注册、记忆分层（L1–L4）、MCP/ACP 协议、Runtime、Gateway（Discord / 微信 / WebUI）。

核心原则：

- **记忆分层**：L1 原始对话 → L2 蒸馏 → L3 事实库 → L4 检索
- **工具扁平暴露**：本地 / MCP / ACP 三层注册，对 LLM 统一工具列表
- **凭证隔离**：pass GPG 存储，运行时注入；LLM 只见路径不见值
- **Gateway**：多通道消息入口
- **EventBus**：消息后的异步蒸馏、反思、索引

---

## 启动协议

1. **先读** [`TODOS.md`](TODOS.md) — 当前任务，最高优先级
2. **原则与方向** [`ARCHITECTURE.md`](ARCHITECTURE.md) — 改架构 / 记忆 / 凭证前必读
3. **动态细节** [`docs/context/project-context.md`](docs/context/project-context.md) — 命令、工具表、模块树
4. 按任务展开 `docs/` 专题（见下方文档地图）

### 风格约定（不可协商）

- 类型注解全覆盖
- 错误返回 JSON 格式 `{"error": "..."}` 字符串
- 成功的工具返回 JSON 字符串
- 安全路径规则以代码实现为准（写保护路径/设备阻塞/二进制过滤）
- 新功能必须补测试（最小化但可用）
- 功能变更和架构调整必须同步更新相关文档

### 新栈包命名（RFC #1）

新栈 workspace 包名 **一律以 RFC 层名为首段前缀**（完整规约见 [`docs/designs/issue-1-migration-plan.md`](docs/designs/issue-1-migration-plan.md)）：

| 形态 | 模式 | 示例 |
|------|------|------|
| 层聚合 | `@freeanima/{layer}` | `kernel`、`engine`、`service` |
| 层内组件 | `@freeanima/{layer}-{slug}` | `kernel-eventbus`、`engine-tool`、`life-memory`、`capabilities-tools` |
| 层内实现 | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-sqlite`、`capabilities-provider-openai` |

- slug 合成词不加内连字符（`eventbus` 非 `event-bus`）。
- legacy 包仍为 `@freeanima/legacy-*`。
- Hook / EventTopic 的 qualifiedId 与 npm 包名独立。

新建或 rename 包时必须遵循上表；模块路径见 [`docs/context/project-context.md`](docs/context/project-context.md)。

### 文档地图

**根目录**

| 文件 | 职责 |
|------|------|
| [`AGENTS.md`](AGENTS.md) | Agent 启动协议（本文件） |
| [`TODOS.md`](TODOS.md) | 当前可执行任务 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 架构原则、结构、方向规划 |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本变更 |
| [`README.md`](README.md) | 项目介绍与快速开始 |

**docs/**

| 文件 | 职责 |
|------|------|
| [`docs/context/project-context.md`](docs/context/project-context.md) | 命令、测试、模块树、工具表 |
| [`docs/database.md`](docs/database.md) | PostgreSQL schema 与迁移 |
| [`docs/memory.md`](docs/memory.md) | 记忆管道 L1–L4 |
| [`docs/self-layer.md`](docs/self-layer.md) | 自我层 L1–L4 |
| [`docs/identity.md`](docs/identity.md) | 数字生命定位与 SOUL 约定 |
| [`docs/sleep.md`](docs/sleep.md) | 睡眠机制（微睡/深睡） |
| [`docs/security.md`](docs/security.md) | 安全矩阵与部署须知 |
| [`docs/versioning.md`](docs/versioning.md) | SemVer 发版 |
| [`docs/designs/`](docs/designs/) | 专题设计（Probe、桌面伴侣、结对编程等） |

### 冲突优先级

1. **代码实现** > 一切文档
2. **ARCHITECTURE.md** > 专题 `docs/*.md`
3. **docs/context/project-context.md** > 其他 `docs/`
4. **TODOS.md** > ARCHITECTURE 方向规划

### 改代码必须改哪份 doc

| 变更类型 | 更新 |
|----------|------|
| 新工具 / 工具行为 | `docs/context/project-context.md` 工具表 |
| 新模块 / 目录结构 | `docs/context/project-context.md` 架构速览 |
| 新建 RFC 新栈包 / 包 rename | 本文件（命名规约）+ `docs/context/project-context.md` |
| L1 Session / PG schema | `docs/database.md` + `packages/db/src/schema/` |
| 记忆管道 / 注入 / 检索 | `docs/memory.md` + ARCHITECTURE |
| 安全规则 / 威胁面 | `docs/security.md` + ARCHITECTURE |
| 架构原则 / 方向 | ARCHITECTURE.md |
| 发版 | `docs/versioning.md`（Conventional Commits；CI 自动 bump） |
| 任务完成 | 从 TODOS 删除；用户可见变更用 `feat:`/`fix:` commit，由 semantic-release 写入 CHANGELOG |

### 维护规约

- 会周变的细节只改 `docs/context/project-context.md`
- 原则变更先 ARCHITECTURE，再决定是否缩减专题 doc
- 任务完成 → 从 TODOS 删除（不保留已完成项）
- 新专题 >50 行且长期有效才进 `docs/`，否则进 TODOS
- 发版遵循 [`docs/versioning.md`](docs/versioning.md)

### 各文件禁止写什么

| 文件 | 禁止 |
|------|------|
| AGENTS.md（本文件） | 工具表、目录树、命令、SemVer 步骤 |
| docs/context/project-context.md | 身份叙事、SemVer 细则 |
| ARCHITECTURE.md | 具体待办、会周变的工具表 |
| TODOS.md | 已完成项、架构长篇、废弃考古 |

---

## 常驻约束（给所有 Agent）

- 安全性是底线：凭证不暴露、路径不泄露、工具不滥用
- 连续性高于功能丰富度；记忆与自我层改动需格外谨慎（见 [`docs/identity.md`](docs/identity.md)）
- 简单基础设施自己写，复杂逻辑用三方库
- 手机推送 (`send_push`) 凭证见 pass `services/pushdeer`

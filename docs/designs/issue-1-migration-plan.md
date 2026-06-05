## 迁移方案补充（2026-06-02）

> 回应 Issue 待讨论 #4（迁移策略），并补充现状评估结论。

### 策略选型：并行新包 + 自底向上逐包迁移（Strangler Fig）

不在旧 `packages/*` 内渐进重构，而是在仓库根目录**按 RFC 层级新建目录**，从 **kernel 起逐包向上迁移**。旧包 rename 为 `@freeanima/legacy-*`，新包直接使用目标名 `@freeanima/kernel` 等。

**已确认决策：**

- **目录布局**：根目录平铺 — `kernel/`、`engine/`、`life/`、`capabilities/`、`connectors/`、`service/`、`cli/`
- **包名共存**：旧包 → `@freeanima/legacy-*`；新包 → 目标名（见下方命名规约）

### 新栈包命名（2026-06-04）

命名单一真相源：[`AGENTS.md`](../../AGENTS.md#新栈包命名rfc-1)。

| 形态     | 模式                               | 示例                                                         |
| -------- | ---------------------------------- | ------------------------------------------------------------ |
| 层聚合   | `@freeanima/{layer}`               | `kernel`、`engine`、`service`                                |
| 层内组件 | `@freeanima/{layer}-{slug}`        | `kernel-eventbus`、`engine-tool`、`life-memory`              |
| 层内实现 | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-sqlite`、`capabilities-provider-openai` |

slug 合成词不加内连字符（`eventbus` 非 `event-bus`）。

### 目标目录结构

```
freeanima/
├── kernel/
│   ├── eventbus/              # @freeanima/kernel-eventbus
│   ├── hooks/                 # @freeanima/kernel-hooks
│   ├── logging/               # @freeanima/kernel-logging
│   └── kernel/                # @freeanima/kernel（聚合）
├── engine/                    # @freeanima/engine（聚合）；子包 engine-tool、engine-provider 等
├── life/
│   ├── memory/                # @freeanima/life-memory
│   ├── self/                  # @freeanima/life-self
│   └── estate/                # @freeanima/life-estate
├── capabilities/
│   ├── tools/                 # @freeanima/capabilities-tools
│   ├── provider/              # @freeanima/capabilities-provider（或 capabilities-provider-openai）
│   ├── mcp/                   # @freeanima/capabilities-mcp
│   ├── acp/                   # @freeanima/capabilities-acp
│   └── clarify/               # @freeanima/capabilities-clarify
├── connectors/
│   ├── eventbus-sqlite/       # @freeanima/connectors-eventbus-sqlite
│   ├── gateway/               # @freeanima/connectors-gateway
│   ├── webui/                 # @freeanima/connectors-webui（HTTP server + Vue SPA）
│   ├── cron/                  # @freeanima/connectors-cron
│   └── commands/              # @freeanima/connectors-commands
├── service/                   # @freeanima/service
├── cli/                       # @freeanima/cli
├── packages/                  # 过渡期 legacy（最终删除）
└── apps/                      # 过渡期 legacy（最终删除）
```

### pnpm-workspace 扩展

```yaml
packages:
  - "kernel"
  - "engine"
  - "life/*"
  - "capabilities/*"
  - "connectors/*"
  - "service"
  - "cli"
  - "packages/*" # legacy，逐步清空
  - "apps/*" # legacy，逐步清空
```

### 迁移步骤

| 步骤 | 包                       | 完成标准                                                | 旧栈影响                |
| ---- | ------------------------ | ------------------------------------------------------- | ----------------------- |
| 0    | legacy rename            | 全 repo import 指向 `@freeanima/legacy-*`；CI 绿        | 仅机械 rename，行为不变 |
| 1    | `kernel/`                | 纯接口+schema；零 legacy 依赖                           | 无                      |
| 2    | `capabilities/provider/` | LLM Provider 实现；仅依赖 kernel                        | 无                      |
| 3    | `engine/`                | 主循环+工具循环；SessionStore 接口注入；零 registerTool | 无                      |
| 4    | `life/memory/`           | 从 legacy-memory 移植；仅 kernel + db                   | 无                      |
| 5    | `life/self/`             | SOUL + HOOK_BUILD_SYSTEM_PROMPT；从 memory 拆出         | 无                      |
| 6    | `life/estate/`           | 可先空壳（凭证列表 API 占位）                           | 无                      |
| 7    | `capabilities/*`         | tools/mcp/acp/clarify；禁止 import engine/runtime       | 无                      |
| 8    | `connectors/*`           | gateway/cron/commands/webui；依赖 kernel+engine         | 无                      |
| 9    | `service/`               | 替代 serve.ts + NestService；组装全栈                   | **切换日**              |
| 10   | `cli/`                   | `anima` bin 指向新 service                              | **切换日**              |
| 11   | 删 legacy                | 移除 `packages/`、`apps/` legacy                        | 完成                    |

切换日前 production 始终跑 legacy 栈；步骤 1–8 新栈独立构建测试。

### 横切模块

| 模块                          | 过渡期                                              | 最终归属                            |
| ----------------------------- | --------------------------------------------------- | ----------------------------------- |
| `@freeanima/kernel-db`        | **已迁入** `kernel/db`；life/memory 与 service 共用 | 长期持久化层；类型在 kernel-schemas |
| EventBus/registry/config 实现 | 新 kernel 只留接口                                  | service                             |
| Turbo/CI                      | 新栈加独立 `test:next` job                          | 切换后合并                          |

### 关键设计决策（回应待讨论项）

| #   | 问题               | 决策                                              |
| --- | ------------------ | ------------------------------------------------- |
| 1   | 零工具启动时主循环 | 已满足，空 tool list 即可纯对话，无需特殊处理     |
| 2   | Skills 归属        | **memory**（程序性记忆）；self 负责 HOOK 注入     |
| 3   | 能力层注册方式     | 各包独立 export，**service 层统一 register 入口** |
| 4   | 迁移策略           | **并行新包 + legacy rename**（本文方案）          |

### 新栈必做改进（legacy 不修）

1. **TurnLifecycle 统一** — 消除 nest-service / engine conversation / cron runner 三处拷贝
2. **SessionStore 接口注入** — 新 engine 不直调 db；接口定义在 kernel，service 注入实现
3. **NestService 在新 service/ 按 RFC 职责重写** — legacy 仅作行为参考与 acceptance tests 来源

### 层边界 CI enforce（目录就绪后）

- `kernel/**` 不得 import workspace 包
- `engine/**`、`life/**`、`capabilities/**` 不得互 import
- `capabilities/**` 不得 import engine/service/connectors

### PR 拆分原则

**一步一 PR**；步骤 0 单独做，不与步骤 1 合并。

### 步骤 0（独立 PR）：legacy rename

**范围：仅机械改名，零逻辑变更，不创建新层目录。**

1. 现有 `packages/*`、`apps/*` 的 `package.json` → `name` 改为 `@freeanima/legacy-*`
2. 全 repo 所有 import / workspace 依赖 / turbo 配置同步更新
3. 根 `package.json` devDependencies、bin 路径等指向 legacy 包名
4. 跑全量 CI（typecheck + test），必须全绿
5. 必要时更新 `AGENTS.md` / 本文件标注 legacy 包名映射（不维护独立模块树文档）

**legacy 包名映射（示例）：**

| 现名（步骤 0 前）         | legacy 名（步骤 0 后）                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| `@freeanima/kernel`       | ~~`@freeanima/legacy-kernel`~~（已删，拆至 kernel-_ / service-_）        |
| `@freeanima/engine`       | ~~`@freeanima/legacy-engine`~~（已删，拆至 engine-\* / life-memory）     |
| `@freeanima/runtime`      | `@freeanima/legacy-runtime`                                              |
| `@freeanima/memory`       | ~~`@freeanima/legacy-memory`~~ → `@freeanima/life-memory`                |
| `@freeanima/db`           | ~~`@freeanima/legacy-db`~~ → `@freeanima/kernel-db`（`kernel/db`）       |
| `@freeanima/server`       | `@freeanima/legacy-server`                                               |
| `@freeanima/gateway`      | ~~`@freeanima/legacy-gateway`~~ → `@freeanima/connectors-gateway`        |
| `@freeanima/tools`        | `@freeanima/legacy-tools`（core 已拆至 `@freeanima/capabilities-tools`） |
| `@freeanima/integrations` | `@freeanima/legacy-integrations`                                         |
| `@freeanima/clarify`      | ~~`@freeanima/legacy-clarify`~~ → `@freeanima/capabilities-clarify`      |
| `@freeanima/api`          | `@freeanima/legacy-api`                                                  |
| `@freeanima/cli`          | `@freeanima/legacy-cli`                                                  |
| `@freeanima/webui`        | `@freeanima/legacy-webui`                                                |

**已删除 legacy 包（2026-06-05）：** `@freeanima/legacy-kernel`、`@freeanima/legacy-engine`、`@freeanima/legacy-db`、`@freeanima/legacy-memory`、`@freeanima/legacy-integrations`。`packages/*` 与 `apps/*` legacy 壳已清空（2026-06-05 L2）；`@freeanima/runtime/server/tools/api/cli` 等职责分别迁入 `service/`、`kernel/api`、`cli/` 等新栈包。

**步骤 0 不做：** 不建 `kernel/` 等新目录；不改 `pnpm-workspace.yaml` 新层 glob；不改运行时行为。

### 步骤 1（独立 PR）：新建 `kernel/`

1. 扩展 `pnpm-workspace.yaml`（加入 `kernel` 等新层 glob 可在此步或逐步加）
2. 创建 `kernel/package.json`（`@freeanima/kernel`），纯接口骨架 + schemas
3. 新 kernel 单测；legacy 栈 CI 仍绿

### 现状评估摘要

- RFC 架构方向与 ARCHITECTURE.md 一致，**建议采纳**
- 现状契合度提升：kernel / engine legacy 包已删，新栈 `kernel/*`、`engine/*`、`service/*` 已承载主路径 import；runtime NestService ~940 行 ✗；能力层逆向依赖 runtime/engine ✗
- 并行新包方案优于在 legacy 内拆 NestService，生产风险推迟至 service/cli 切换日

## 迁移方案补充（2026-06-02）

> 回应 Issue 待讨论 #4（迁移策略），并补充现状评估结论。

### 策略选型：并行新包 + 自底向上逐包迁移（Strangler Fig）

不在旧目录内渐进重构，而是在仓库根目录**按 RFC 层级平铺目录**，从 **kernel 起逐包向上迁移**。**迁移已于 2026-06-05 完成**（`packages/`、`apps/` 已删除）。

**已确认决策：**

- **目录布局**：根目录平铺 — `kernel/`、`engine/`、`life/`、`capabilities/`、`connectors/`、`service/`、`cli/`
- **包命名**：`@freeanima/{layer}-{slug}`（见 [`AGENTS.md`](../../AGENTS.md)）

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
├── service/                   # @freeanima/service（AnimaService + serve）
├── cli/                       # @freeanima/cli
└── tests/                     # @freeanima/integration-tests
```

### workspace（bun）

```yaml
packages:
  - "kernel/*"
  - "engine/*"
  - "life/*"
  - "capabilities/*"
  - "connectors/*"
  - "service/*"
  - "cli"
  - "tests"
```

### 迁移步骤

| 步骤 | 包     | 状态                    |
| ---- | ------ | ----------------------- |
| 0–11 | 见下表 | ✅ 已完成（2026-06-05） |

| 步骤 | 包                       | 完成标准                                            |
| ---- | ------------------------ | --------------------------------------------------- |
| 0    | legacy rename            | 全 repo import 切 legacy；后已删 legacy 壳          |
| 1    | `kernel/`                | hooks / eventbus / schemas / db                     |
| 2    | `capabilities/provider/` | LLM Provider 实现                                   |
| 3    | `engine/`                | 主循环+工具循环；engine 直调 `@freeanima/kernel-db` |
| 4    | `life/memory/`           | 记忆管道、skills、检索                              |
| 5    | `life/self/`             | 空壳（`@freeanima/life-self`）                      |
| 6    | `life/estate/`           | 空壳（`@freeanima/life-estate`）                    |
| 7    | `capabilities/*`         | tools / mcp / acp / clarify                         |
| 8    | `connectors/*`           | gateway / cron / commands / webui                   |
| 9    | `service/`               | `serve` + `AnimaService` 组装全栈                   |
| 10   | `cli/`                   | `anima` bin → `@freeanima/service`                  |
| 11   | 删 legacy                | 移除 `packages/`、`apps/`                           |

生产入口：`anima service` → [`service/service/src/serve.ts`](../../service/service/src/serve.ts)。

### 横切模块

| 模块                          | 过渡期                                               | 最终归属                            |
| ----------------------------- | ---------------------------------------------------- | ----------------------------------- |
| `@freeanima/kernel-db`        | **已迁入** `kernel/db`；life/memory 与 service 共用  | 长期持久化层；类型在 kernel-schemas |
| EventBus/registry/config 实现 | 新 kernel 只留接口                                   | service                             |
| Turbo/CI                      | 已合并入主 CI（typecheck / lint / dep-check / test） |

### 关键设计决策（回应待讨论项）

| #   | 问题               | 决策                                              |
| --- | ------------------ | ------------------------------------------------- |
| 1   | 零工具启动时主循环 | 已满足，空 tool list 即可纯对话，无需特殊处理     |
| 2   | Skills 归属        | **memory**（程序性记忆）；self 负责 HOOK 注入     |
| 3   | 能力层注册方式     | 各包独立 export，**service 层统一 register 入口** |
| 4   | 迁移策略           | **并行新包 + legacy rename**（本文方案）          |

### 新栈必做改进

1. **TurnLifecycle 统一** — ✅ `turn-lifecycle.ts`（非流式 + 流式）
2. **engine 直调 db** — ✅ `engine-conversation` → `@freeanima/kernel-db`（不做 SessionStore 注入）
3. **AnimaService 拆分** — ✅ `anima-service` + status/sessions/memory/messaging 模块

### 层边界 dep-check

脚本：[`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts)，`bun run dep-check`（已挂入 `bun run check`）。

| 层                | 允许 `@freeanima/*`                                                                           | 禁止                                 |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------ |
| `kernel/**`       | `kernel-*`                                                                                    | 其他 workspace 包                    |
| `engine/**`       | `kernel-*`、`engine-*`、`service-config`、`service-logging`、`capabilities-provider-*`        | `connectors-*`、`service`（runtime） |
| `life/**`         | `kernel-*`、`life-*`、`engine-tool`、`connectors-sqlite`、`service-config`、`service-logging` | 其他 `connectors-*`、`service`       |
| `capabilities/**` | `kernel-*`、`engine-*`、`capabilities-*`、`life-memory`、`service-config`、`service-logging`  | `connectors-*`、`service`            |
| `connectors/**`   | 各下层 + `service`                                                                            | —                                    |
| `service/**`      | 全部                                                                                          | —                                    |

测试文件（`**/*.{test,spec}.ts`、`**/tests/**`）与 `cli/**` 豁免。

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

### 现状评估摘要（2026-06-05）

- RFC 迁移步骤 0–11 **已完成**
- 运行时入口：`AnimaService`（[`service/service/src/runtime/`](../../service/service/src/runtime/) 模块化拆分）
- 层边界：`bun run dep-check`（[`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts)）
- 待迁入：`life-self`（SOUL / 自我层）、`life-estate`（资源层）由空壳包承接

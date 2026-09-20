---
title: 分包与依赖约束
---

# 分包与依赖约束

代码布局的权威规格（**代码是 SSOT**，结构漂移时与代码同 PR 改本文件）。
配套：[`repository-topology.mdc`](../../.cursor/rules/repository-topology.mdc)（目录地图 / 解析）、
[`code-layers.mdc`](../../.cursor/rules/code-layers.mdc)（依赖矩阵与护栏）。

## 13 个包（均不发布）

| 包                        | 路径                                       | 装什么                                                                                           | 允许依赖的 `@freeanima` 包                           |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `@freeanima/shared`       | `packages/shared/`                         | 契约（Zod）、`pg-shapes`、`rpc-contract`、`habitat-contract`、vault-crypto、同构工具             | ——（叶层）                                           |
| `@freeanima/kernel`       | `packages/kernel/`                         | Cordis 组合根句柄、logger、`config-mechanism`、logging、random                                   | shared                                               |
| `@freeanima/core`         | `packages/core/`                           | drizzle schema/migrations、PG、Redis、config 段与 runtime store、llm/tool/tokenizer/tts/compress | kernel, shared                                       |
| `@freeanima/engine`       | `packages/engine/`                         | conversation / turn / goal / pipeline / loop-mechanism                                           | core, kernel, shared                                 |
| `@freeanima/capabilities` | `packages/capabilities/`                   | memory / tools / connectors / self / outpost / mcp-* / federation / llm-openai                   | engine, core, kernel, shared                         |
| `@freeanima/features`     | `packages/features/<slug>/`                | 28 个服务端特性（26 个带 `cordis-plugin.ts`；见「特性两态」）                                    | capabilities, engine, core, kernel, shared           |
| `@freeanima/server`       | `packages/server/`                         | 组合根：boot、habitat-api（HTTP/RPC 面）、ports、config 真实现、tls                              | features, capabilities, engine, core, kernel, shared |
| `@freeanima/cli`          | `packages/cli/`                            | `anima` / `anima-client` / `anima-probe`（`{anima,client,probe}/`）                              | server, features, capabilities, core, kernel, shared |
| `@freeanima/ui-kit`       | `packages/ui-kit/`                         | 设计系统（无业务逻辑）                                                                           | shared                                               |
| `@freeanima/portal-sdk`   | `packages/portal-sdk/`                     | SPA 运行时与数据面（typed habitat client、offline、speech、settings 原语）                       | ui-kit, shared                                       |
| `@freeanima/ui-features`  | `packages/ui-features/<slug>/ui/<bundle>/` | 24 个 UI 特性；`ui/spa` 默认 bundle，卫星窗用 `ui/float`                                         | portal-sdk, ui-kit, shared                           |
| `@freeanima/app-frame`    | `packages/app-frame/`                      | 应用布局 chrome、路由表、设置页 chrome                                                           | ui-features, portal-sdk, ui-kit, shared              |
| `@freeanima/portal`       | `packages/portal/`                         | 入口宿主：`app/{web,tauri}` + `extension`（WXT MV3）                                             | app-frame, ui-features, portal-sdk, ui-kit, shared   |

`@freeanima/site`（`site/`）是文档站，不参与运行时 DAG。

**两条链 + 一个共享叶层：**

```text
server 链： shared → kernel → core → engine → capabilities → features → server → cli
前端链：   shared → ui-kit → portal-sdk → ui-features → app-frame → portal
```

`server` 与 `cli` 是入口/组合根，可依赖其下全部服务端包；前端链不得触碰任何服务端包
（唯一交叉点是 `shared`）。

## 命名与勿混淆

- `@freeanima/features/*` = **服务端**特性；`@freeanima/ui-features/*` = **UI** 特性。
  同名 slug（如 `task`）在两侧各有一份，靠包名区分——不再有「一个前缀、两棵树」的隐式解析。
- `@freeanima/features/habitat/*` 是**栖息地管理台的服务端**（RPC + ops 面），
  不是 `@freeanima/ui-features/habitat/*`（管理台 UI），也不是 `shared/habitat-*`。
- 已退役前缀：`@freeanima/habitat/*`、`@freeanima/frontend/*`、`@freeanima/client/*`、
  `@freeanima/platform/*`、`@freeanima/host/*`。由
  `scripts/check-retired-imports.ts` 守护。

## Cordis 模型

- 每层 = 一组 Cordis 插件/服务；特性 = `packages/features/<slug>/cordis-plugin.ts`
  经 `createFeaturePlugin` 挂到 `ctx.features`。
- 进程只有**一个**根 `Context`，由 `createKernel()` 安装（`packages/kernel/context.ts`）。
  模块级全局桥（`globalThis[Symbol.for]` / 服务定位注册表）为 0 条，由
  `scripts/check-module-globals.ts` + oxlint `freeanima/no-module-globals` 守护。
- `@freeanima/capabilities/ports/` 的 `ctx.platformPorts` 与各 `*-port.ts` 是能力/特性
  回调组合根的**唯一**通道（`habitat-dispatch`、`session-pumps`、`task-reminder-schedule`、
  `runtime-deps`、`app-runtime-context` 等）。
- **统一测试 harness**：`@freeanima/kernel/testing` 的 `createTestContext({ logger?, mount? })`
  —— 装配全新根 context/logger（与 `createServiceKernel` 同一条路径），`mount()`
  按生产 mount 助手挂服务，`dispose()` 逆序卸载并清空根句柄。放在 kernel 是为了每一层
  都能 import（自身只依赖 Context + logger）。

## PG → 前端

DDL 仅 `packages/core/db`；存储形状的纯 Zod 经 **codegen + package exports** 落到
`@freeanima/shared/pg-shapes`；前端与协议只依赖该出口（`check-frontend-no-drizzle`
用 Vite 模块图抽样断言）。

## 护栏（`just qa check` 全跑）

| 脚本                                   | 断言                                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| `scripts/check-package-deps.ts`        | 每个包 `package.json` 的 `@freeanima` 依赖 ⊆ DAG（无债务登记通道）  |
| `scripts/check-layer-deps.ts`          | 全仓层依赖扫描（含相对路径与测试文件）；基线为空，任何违规即失败    |
| `scripts/check-package-paths.ts`       | 代码里的 `packages/*` 路径字面量必须指向真实目录（防退役树复活）    |
| `scripts/check-external-deps.ts`       | 包内第三方 import 已在该包 `package.json` 声明（拆包/搬迁不漏依赖） |
| `scripts/check-module-globals.ts`      | 模块级全局桥/进程根句柄存量棘轮（收尾目标为 0）                     |
| `scripts/check-boot-plugin-parity.ts`  | `cordis.yml` 与 TS 侧插件清单一致                                   |
| `scripts/check-retired-imports.ts`     | 无残留退役前缀                                                      |
| oxlint `freeanima/layer-deps`          | 单文件即时反馈（同一 DAG 实现）                                     |
| oxlint `freeanima/no-module-globals`   | 禁止新增全局桥                                                      |
| `scripts/check-frontend-no-drizzle.ts` | Vite 模块图无 drizzle-orm                                           |
| `scripts/check-shared-shapes.ts`       | `pg-shapes` codegen 无漂移                                          |

## 已知债务（棘轮，只减不增）

**当前状态：文件级 0 个层对 / 0 文件（重构起点 178 文件），包级反向边 0 条。**
`scripts/oxlint-plugins/freeanima/lib/layer-deps-baseline.ts` 为空表；
`scripts/check-package-deps.ts` 的 `REVERSE_EDGE_DEBT` 机制已随债务还清一并删除——
新出现的反向依赖（文件级或 `package.json` 级）一律直接失败，不再有登记通道。

**构建工具链车道：** `vite*.config.ts` / `build*.ts`（satellite 构建入口）不参与 DAG——
它们只产出 bundle，不进入运行时依赖图。

**跨 bundle 壳桥：** 卫星窗（`ui/float` 等）与 `portal-sdk/pomodoro-active` 只能依赖
`portal-sdk`，因此 Tauri 壳桥（`portal-sdk/shell-bridge/`）与壳配置读盘器
（`shared/shell-config/`）放在下两层；`portal/app/tauri/*` 留垫片再导出，native 侧只保留
Rust/IPC 与宿主装配。

## 特性两态

`packages/features/<slug>/` 有两种形态，由 `cordis-plugin.ts` 是否存在区分：

- **路由特性**（26 个）：`cordis-plugin.ts` + `domain/` + `habitat/`（Habitat RPC 路由与
  handler）+ 视需要 `protocol/`（method-defs 与帧类型）。经 `builtinFeaturePlugins`
  挂到 `ctx.features`。
- **工具特性**（`content-block`、`workflow`）：只有 `domain/`，通过
  `server/register-tools.ts` 贡献工具，不占 Habitat 方法面——因此没有 `cordis-plugin.ts`，
  也不在 `cordis.yml` 特性清单内。

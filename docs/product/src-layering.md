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
| `@freeanima/features`     | `packages/features/<slug>/`                | 27 个服务端特性：`cordis-plugin.ts` + `domain/` + `habitat/` + `protocol/`                       | capabilities, engine, core, kernel, shared           |
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
  `scripts/codemod-freeanima-imports.ts --check` 守护。

## Cordis 模型

- 每层 = 一组 Cordis 插件/服务；特性 = `packages/features/<slug>/cordis-plugin.ts`
  经 `createFeaturePlugin` 挂到 `ctx.features`。
- 进程只有**一个**根 `Context`，由 `createKernel()` 安装（`packages/kernel/context.ts`）。
  模块级全局桥（`globalThis[Symbol.for]` / 服务定位注册表）为 0 条，由
  `scripts/check-module-globals.ts` + oxlint `freeanima/no-module-globals` 守护。
- `packages/server/ports/` 的 `ctx.platformPorts` 是能力/特性回调组合根的**唯一**通道。

## PG → 前端

DDL 仅 `packages/core/db`；存储形状的纯 Zod 经 **codegen + package exports** 落到
`@freeanima/shared/pg-shapes`；前端与协议只依赖该出口（`check-frontend-no-drizzle`
用 Vite 模块图抽样断言）。

## 护栏（`just qa check` 全跑）

| 脚本                                           | 断言                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `scripts/check-package-deps.ts`                | 每个包 `package.json` 的 `@freeanima` 依赖 ⊆ DAG（反向边债务显式登记） |
| `scripts/check-layer-deps.ts`                  | 全仓层依赖扫描（含相对路径与测试文件）+ 存量基线棘轮                   |
| `scripts/check-module-globals.ts`              | 模块级全局桥为 0（基线已空）                                           |
| `scripts/check-boot-plugin-parity.ts`          | `cordis.yml` 与 TS 侧插件清单一致                                      |
| `scripts/codemod-freeanima-imports.ts --check` | 无残留退役前缀                                                         |
| oxlint `freeanima/layer-deps`                  | 单文件即时反馈（同一 DAG 实现）                                        |
| oxlint `freeanima/no-module-globals`           | 禁止新增全局桥                                                         |
| `scripts/check-frontend-no-drizzle.ts`         | Vite 模块图无 drizzle-orm                                              |
| `scripts/check-shared-shapes.ts`               | `pg-shapes` codegen 无漂移                                             |

## 已知债务（棘轮，只减不增）

包级登记见 `scripts/check-package-deps.ts` 的 `REVERSE_EDGE_DEBT`，文件级见
`scripts/oxlint-plugins/freeanima/lib/layer-deps-baseline.ts`：

| 反向边                            | 现状                                                               | 收尾方向                                               |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `features → server`               | 57 文件（ports/config/service/use-cases）                          | 特性插件经 `ctx` 取服务，删模块级 import               |
| `capabilities → server`           | 27 文件（logging/config/ports）                                    | `logComponent` 走 kernel；runtime-config 机制下沉 core |
| `capabilities → features`         | 17 文件（email/vault 连接器、room handlers、session pumps、media） | 连接器随特性归位；跨特性改端口注入                     |
| `core → capabilities`             | 5 个跨包单测                                                       | 测试迁到上层包或改用 shared 契约                       |
| `ui-features → app-frame`         | 6 个卫星窗构建配置                                                 | 卫星构建脚本迁到 `packages/portal/satellites/`         |
| `ui-features/portal-sdk → portal` | 4 处 tauri bootstrap 动态 import                                   | portal 注册壳桥，卫星经 portal-sdk 取用                |
| `ui-kit → portal-sdk`             | 2 文件（anima-uri / subject-scope）                                | 纯函数下沉 shared；实体标签移入 ui-features            |
| `app-frame → core`                | 3 文件（LLM 预设/连接 schema/语音目录）                            | 契约下沉 shared                                        |

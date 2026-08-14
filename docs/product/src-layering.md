---
title: src 分层与依赖约束
---

# src 分层与依赖约束

方向文档（风巢项目 17683 / 史诗 #17713）。**今日代码仍为根单包 + `src/` 别名**；下文是目标态与分阶段落地索引。实现约束以本文件 + [`.cursor/rules/repository-topology.mdc`](../../.cursor/rules/repository-topology.mdc) / [`code-layers.mdc`](../../.cursor/rules/code-layers.mdc) 为准；冲突时以代码与本文件「目标态」对齐的 PR 为准。

## 目标态：三分包（不发布）

| 包           | 含义                 | 装什么                                                                | 依赖禁令                                   |
| ------------ | -------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| **shared**   | 前后端共享           | 契约、纯 Zod 出口、vault-crypto、无 UI 工具                           | 无 drizzle / 无 React / 默认无 DOM·Node fs |
| **habitat**  | 栖息地进程栈（后端） | 今日 `host/*` + features 服务端 + **CLI** + MCP server                | 无 React / 无浏览器 DOM API                |
| **frontend** | 前端                 | `client` + `ui-kit` + `features/*/ui` + Web/扩展入口 + Tauri 所载 SPA | 无 drizzle / 无仅后端库                    |

不用 `backend` 命名——与产品「Habitat / 栖息地」对齐。物理目录可渐进搬迁；workspace 名先按此三分。

今日 `src/host/` 在别名上可逐步映射为 habitat 栈（如 `@freeanima/habitat/...`）；未完成改名前列在映射表，避免一次大爆改。

### 加厚 kernel（在 habitat 内）

```text
kernel/
  hooks / logging / token / 纯工具（uuid、omitUndefined…）
  config-mechanism/   # 容器、section 注册、热 apply 端口（无 llm/mcp 字段）
  loop-mechanism/     # 纯 LLM↔tool↔stream + StreamEvent（无 turn/memory）
```

**不进 kernel：** 各 config 参数段、turn/conversation、drizzle/PG、capabilities、React、具体 MCP/gateway apply。

### PG → frontend

DDL 仅 habitat。存储形状的纯 Zod 经 **codegen + package exports** 落到 shared；frontend / 协议只依赖该出口。不是 PG introspect，不是前端 import drizzle。线格式（ISO string）与存储（`Date`）分界须显式处理。

## Portal：体感 6 vs 代码 4

| 视角             | 数量  | 成员                                       |
| ---------------- | ----- | ------------------------------------------ |
| **业务体感**     | **6** | Web / 桌面 / 移动 + 浏览器扩展 + CLI + MCP |
| **代码 form id** | **4** | `application` / `browser` / `mcp` / `cli`  |

`application` = Web∪桌面∪移动（一个 form、三壳）。拆包按 **4 form** 归依赖，不按 6 拆六个平行包。

| form id     | 业务壳      | 今日路径                       | 目标归属     |
| ----------- | ----------- | ------------------------------ | ------------ |
| cli         | CLI         | `src/portal/cli`               | **habitat**  |
| mcp         | MCP         | `host/capabilities/mcp-server` | **habitat**  |
| application | Web         | `src/portal/app/web`           | **frontend** |
| application | 桌面 / 移动 | `src/portal/app/tauri`         | **frontend** |
| browser     | 扩展        | `src/portal/extension`         | **frontend** |

不保留与三分包平行的大 `portal` 业务包。`portal-sdk` / `app-frame` 留在 frontend。产品术语仍见 [`i18n/glossary.md`](../../i18n/glossary.md)、[`docs/modules/portal.md`](../modules/portal.md)。

## 五问结论

### 1. Config：拆机制与参数；机制进加厚 kernel

| 层   | 内容                                                                                          | 落点                           |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| 机制 | Config 容器/bind；bootstrap vs runtime；section 注册表；热 apply 端口；YAML/env/sanitize 骨架 | kernel                         |
| 参数 | 各段 Zod（llm/mcp/…）；具体 apply 分支                                                        | core / capabilities / platform |

热更新今日是 PG section patch → apply，不是 `fs.watch`。产品段用 `registerSection` 挂上。

### 2. Agent loop：纯循环进 kernel；turn 留 engine

可抽：LLM↔tool↔stream、`StreamEvent`、hook 端口。须先把 compress / 默认 profile / ALS 会话假设改为注入。**不**迁 turn/conversation/memory/self。

### 3. 三分包：为依赖清晰（不发布）

shared / habitat / frontend 分 `package.json` 依赖 + project references。拆包前必须剪断今日 `shared → host` 回指。

### 4. 从 PG 到前端：codegen + exports，避免污染

| 做法                                   | 评价                       |
| -------------------------------------- | -------------------------- |
| 前端直接 import `host/core/db/schema`  | **禁止**（拖入 drizzle）   |
| codegen 纯 zod → shared + exports 护栏 | **推荐**                   |
| 仅 `import type`                       | 不够（前端需要运行时 Zod） |

### 5. Kernel 加厚

同意：机制进 kernel，业务语义向上。见上文「加厚 kernel」。

### client 与 portal

portal = 形态薄入口（拆入两包）；client = portal-sdk + app-frame（frontend）。Feature UI 不 import portal 源码 / app-frame。

## 现状张力（落地前）

1. 根单包混装前后端 dependencies
2. oxlint：`host/kernel` 已拆为 `host-kernel` 叶层（仅可依赖 kernel + shared）；其余 `host/*` 仍整棵为一层
3. ~~部分 UI 值导入 `host/core/db/schema` barrel~~（P1 已剪；纯 Zod/常量在 `shared/{db-shapes,entity-shapes}`）
4. ~~`shared` 内混有 DOM 与 `node:fs` 入口~~（P1：默认无 DOM；`*-browser` / `*-node` 分入口）
5. ~~存储 Zod 与 rpc-contract 平行手写易漂移~~（P2：`just db shapes` codegen + rpc-contract 组合 `pg-shapes`）
6. ~~config 机制混在 core/platform~~（P3：`host/kernel/config-mechanism` + `registerSection`）

## 分阶段任务（风巢 17683）

| 阶段 | 任务   | 要点                                                                                            |
| ---- | ------ | ----------------------------------------------------------------------------------------------- |
| P0   | #17722 | 本文档 + 死链/rules 方向对齐；收束 #17713                                                       |
| P1   | #17723 | **已落地**：剪 shared→host、frontend→db；oxlint；`just qa check-frontend-no-drizzle`            |
| P2   | #17724 | **已落地**：`createSelectSchema` → `just db shapes` 纯 Zod → `shared/pg-shapes`                 |
| P3   | #17725 | **已落地**：config 机制进 `host/kernel/config-mechanism`；产品段 Zod/apply 经 `registerSection` |
| P4   | #17726 | 纯 loop 进 kernel                                                                               |
| P5   | #17727 | 三 workspace 包 + portal 拆入                                                                   |

依赖：P0→P1→P2→P5；P3/P4 可在 P0 后并行，再汇入 P5。

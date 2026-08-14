---
title: src 分层与依赖约束
---

# src 分层与依赖约束

方向文档（风巢项目 17683 / 史诗 #17713）。**P5（#17727）已落地**：workspace 三分包 `packages/{shared,habitat,frontend}`（不发布）+ `@freeanima/habitat/*` 前缀；portal 按 4 form 拆入两包。实现约束以本文件 + [`.cursor/rules/repository-topology.mdc`](../../.cursor/rules/repository-topology.mdc) / [`code-layers.mdc`](../../.cursor/rules/code-layers.mdc) 为准。

## 三分包（不发布）

| 包           | 路径                 | 装什么                                                                          | 依赖禁令                            |
| ------------ | -------------------- | ------------------------------------------------------------------------------- | ----------------------------------- |
| **shared**   | `packages/shared/`   | 契约、纯 Zod、vault-crypto、同构工具（含 `task/`、`coding/`、`companion-app/`） | 无 drizzle / 无 React / 无 LLM·mail |
| **habitat**  | `packages/habitat/`  | 进程栈（原 host）+ features 服务端 + **CLI** + MCP                              | 无 React                            |
| **frontend** | `packages/frontend/` | client + ui-kit + features UI + Web/扩展/Tauri SPA                              | 无 drizzle / 无仅后端库             |

不用 `backend` 命名——与产品「Habitat / 栖息地」对齐。

**勿混淆：** `@freeanima/habitat/…`（进程栈）≠ `@freeanima/features/habitat/…`（管理台）≠ `shared/habitat-*` / `shared/companion-app`。

### 加厚 kernel（在 habitat 内）

```text
packages/habitat/kernel/
  hooks / logging / token / 纯工具
  config-mechanism/
  loop-mechanism/     # P5：自 engine/loop 物理迁入；仍经 core 适配（叶层分类见 oxlint）
```

**不进 kernel：** 各 config 参数段、turn/conversation、drizzle/PG、capabilities、React、具体 MCP/gateway apply。

### PG → frontend

DDL 仅 habitat。存储形状的纯 Zod 经 **codegen + package exports** 落到 shared；frontend / 协议只依赖该出口。

## Portal：体感 6 vs 代码 4

| form id     | 业务壳      | 路径                                       | 归属         |
| ----------- | ----------- | ------------------------------------------ | ------------ |
| cli         | CLI         | `packages/habitat/portal/cli`              | **habitat**  |
| mcp         | MCP         | `packages/habitat/capabilities/mcp-server` | **habitat**  |
| application | Web         | `packages/frontend/portal/app/web`         | **frontend** |
| application | 桌面 / 移动 | `packages/frontend/portal/app/tauri`       | **frontend** |
| browser     | 扩展        | `packages/frontend/portal/extension`       | **frontend** |

## 分阶段任务（风巢 17683）

| 阶段 | 任务   | 状态                                                                  |
| ---- | ------ | --------------------------------------------------------------------- |
| P0   | #17722 | 已落地                                                                |
| P1   | #17723 | 已落地                                                                |
| P2   | #17724 | 已落地                                                                |
| P3   | #17725 | 已落地                                                                |
| P4   | #17726 | 已落地（注入化）                                                      |
| P5   | #17727 | **已落地**：三包 + portal 拆入 + `loop-mechanism` + host→habitat 改名 |

护栏：`just qa check-package-deps`、`check-frontend-no-drizzle`、`check-shared-shapes`、oxlint `layer-deps`。

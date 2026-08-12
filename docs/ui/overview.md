---
title: "UI / UX"
---

# UI / UX

FreeAnima 入口 UI 的产品设计系统：**视觉基础**、**组件分类**与**交互模式**。三者皆经同一组正交轴适配 — **壳**、**布局**与**交互** — 见 [三维度](dimensions.md)。

覆盖**应用形态 SPA** 与浏览器扩展的 **popup / options**（同一 `@freeanima/ui-kit` 栈）。Content script 不在本设计系统内 — 见 [portal.md](../modules/portal.md)。

本目录是 **UI/UX 规范 SSOT**。Agent 硬禁令、导入规则与 API 入口路径在 [`.agent/rules/`](../../.agent/rules/README.md) 并链到此处。Token 值在代码中（`src/ui-kit/styles/globals.css`）。代码与文档冲突时，**以代码为准**。

## 阅读顺序

1. [dimensions.md](dimensions.md) — 壳 / 布局 / 交互；壳 vs 应用布局
2. [foundations.md](foundations.md) — 色、字、间距、圆角、层级、动效、焦点…
3. [components.md](components.md) — 基元 / 结构 / 复合 / 领域；放置规则
4. [patterns.md](patterns.md) — 可复用交互模式（如 DataListRow）

## 职责划分

| 层                              | 拥有                               | 不拥有               |
| ------------------------------- | ---------------------------------- | -------------------- |
| `docs/ui/`                      | 面向产品的规范、模式契约、维度适配 | IDE 清单、每周工具表 |
| `.agent/rules/ui-dimensions.md` | 硬禁令 + API 速查                  | 长篇产品论述         |
| `.agent/rules/frontend-ui.md`   | 栈禁令、导入边界、复合导入列表     | 完整视觉论述         |
| `src/ui-kit/`                   | 组件 + CSS token（实现 SSOT）      | 产品架构             |
| `docs/aspects/`                 | 横切数据面（同步、刷新、离线）     | 视觉分类             |

功能原型与包触达列表 → [`.agent/rules/frontend-features.md`](../../.agent/rules/frontend-features.md)。

## 采纳

- **新 UI** 必须遵循本语料（及所链 Agent 规则）。
- **既有 UI** 可有偏差；缺口在专题文档中标为 **待对齐**。在后续任务中修复 — 不要为迁就分叉而削弱规范。

## 相关文档

- 产品架构（栈地图）→ [product/architecture.md](../product/architecture.md)
- 页面 sync vs refresh → [aspects/page-refresh.md](../aspects/page-refresh.md)
- 术语表（壳、应用布局等）→ [i18n/glossary.md](../../i18n/glossary.md)

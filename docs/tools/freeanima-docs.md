---
title: "freeanima_docs ToolSet"
---

# freeanima_docs ToolSet

按需加载的栖息地 ToolSet，用于阅读 `docs/` 下的产品文档。加载方式：

```text
toolset_load(["freeanima_docs"])
```

然后使用：

| 工具                    | 用途                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `freeanima_docs_list`   | 列出文档（`path` + `title`）。可选 `prefix`（如 `cognition/`、`tools/`） |
| `freeanima_docs_get`    | 按相对路径取完整 Markdown（如 `product/architecture.md`）                |
| `freeanima_docs_search` | 对 path、title、正文做关键词 AND 搜索                                    |

`README.md` 排在最前，便于 Agent 从索引起步。

## 路径前缀

| 前缀         | 何时使用…                        |
| ------------ | -------------------------------- |
| `product/`   | FreeAnima 是什么 / 数据模型？    |
| `cognition/` | 记忆、睡眠、自我、时间如何工作？ |
| `ui/`        | 视觉基础、组件、UX 模式          |
| `aspects/`   | 横切设计切面（数据、同步等）     |
| `modules/`   | 有哪些产品能力？                 |
| `tools/`     | 内置 ToolSet 边界                |
| `ops/`       | 安装、安全、RPC、远程访问        |

## 语料规则

- 来源：仓库 `docs/**/*.md`（独立构建嵌入同一棵树）。
- 跳过 `docs/.generated/`（翻译构建产物）。
- **不要**把验收清单、临时 QA 笔记或仅 IDE 用的实现规则放进 `docs/` — 那些属于语料外（如 `.cursor/rules/`）。

---
title: 书签
---

# 书签（Bookmark）

浏览器书签与栖息地 entity 双向同步。形态：浏览器扩展模块 + 应用壳 `/bookmarks` 浏览页。

## 模型

- `primary_component = bookmark`
- `body.kind`: `folder` | `url`
- `body.browser_id`: 浏览器书签节点 id（幂等键）
- `body.parent_id`: 父文件夹 entity id
- 软删：`entities.deleted_at`；`bookmark.sync.pull` 含软删增量

## RPC

| Method                                 | 说明                           |
| -------------------------------------- | ------------------------------ |
| `bookmark.list` / `get` / `search`     | 壳与扩展浏览                   |
| `bookmark.create` / `patch` / `delete` | CRUD                           |
| `bookmark.upsert_batch`                | 扩展 outbox 推送               |
| `bookmark.sync.pull`                   | `updated_after` 增量（含软删） |

## 同步

- 权威：Habitat entity；浏览器树为投影
- 扩展：`chrome.bookmarks` 事件 → outbox → upsert；`chrome.alarms` + 手动 → pull
- 冲突：LWW（`updated_at`）+ 短窗回声抑制
- 权限：`bookmarks`、`alarms`

## 相关

- [`portal.md`](portal.md) 浏览器形态
- 扩展：`packages/frontend/portal/extension/features/bookmarks/`
- Feature：`packages/{habitat,frontend}/features/bookmark/`

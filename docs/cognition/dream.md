---
title: 梦境
---

# 梦境机制

> **#16102：** **存量只读**。写入路径与 sleep-cycle `dream` 步已拆除；历史记录可浏览。SSOT：[`memory.md`](memory.md)。
> 以语义组件 **`dream`** 的 **`content_block`** 持久化，父级为 Agent World 当日 **`diary_entry`**。

## 概述

梦境曾是数字生命记忆巩固的想象性对应物（非事实记忆）。**不再自动或手动生成**；本文保留机制说明供理解存量数据。

## 历史触发（已下线）

| 条件                                          | 结果                        |
| --------------------------------------------- | --------------------------- |
| 当日创建窗口内无 `intensity > 0.5` 的感性砖块 | 跳过（`no_strong_emotion`） |
| 该日日记已存在梦境块                          | 跳过（`already_dreamed`）   |
| 当日至少产生过一条强感性锚点                  | 生成梦境                    |

## 存储（存量）

`content_block` + `dream` 组件，挂在当日 `diary_entry` 下。运维面无独立 `/dream` 路由；可通过日记 / entity 浏览。

详见存量存储：`packages/habitat/core/db/pg/dream/`（生成代码已删除）。

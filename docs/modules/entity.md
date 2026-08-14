---
title: 实体模块
---

# 实体（实体浏览器）

跨模块浏览当前 subject world 内全部 `entities` 行，并管理软删回收站。

## 壳

- 路径：`/entity`
- 导航：模块 id `entity`（`habitat_nav_entity`）
- 范围：跟随壳 **User / Agent**（`subject_kind` → 对应 private world）

## 视图

| Tab    | 数据                     | 排序              |
| ------ | ------------------------ | ----------------- |
| 全部   | `deleted_at IS NULL`     | `updated_at DESC` |
| 回收站 | `deleted_at IS NOT NULL` | `deleted_at DESC` |

工具栏：

| 控件   | 行为                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| 搜索框 | 关键词走 hybrid 检索（title/summary/content）；纯正整数或 `anima:{id}` 精确查单条 |
| 类型   | 过滤 `type`：`content` / `world` / `agent` / `user`                               |
| 主组件 | 过滤 `primary_component`（自由文本，如 `task_item`）                              |

行字段：id、title、primary_component、components、时间戳。点击行打开
**详情弹窗**（`entity.get`：summary / content / body 与元数据）。存活行可
**deleteEntity**（软删）；回收站可 **restore**。满 30 天由记忆维护 cleanup **purge** 物理删除；若为
`object_file`，purge 后对无其它引用的 cid 删除对象存储 blob。

## 栖息地 RPC

| 方法                     | 作用                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `entity.list`            | 存活实体分页；可选 `type` / `primary_component` / `query`       |
| `entity.trash.list`      | 回收站分页；入参同 `entity.list`                                |
| `entity.get`             | 单条详情（含 summary/content/body）；回收站需 `include_deleted` |
| `entity.delete`          | 软删；无 `force` 且存在引用时返回 `references`                  |
| `entity.restore`         | 从回收站恢复                                                    |
| `entity.deleteComponent` | 删除单个 component                                              |

`entity.list` / `entity.trash.list` 入参：`subject_kind`、`limit`、`offset`，以及可选
`type`、`primary_component`、`query`。有 `query` 时：id/`anima:` 捷径走
`getEntity`；否则 `searchEntities`（hybrid）。无 `query` 时 `listEntities` + 同条件
`countEntities`。

`entity.get` 仅需 `id`（可选 `include_deleted`）：按实体所在 world 校验调用方可读权限，**不**传 `subject_kind` / `world_id`。

删除语义总表见 [`entity-model.md`](../product/entity-model.md)「删除语义」。

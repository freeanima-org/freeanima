---
title: Entity module
---

# Entity（实体浏览器）

跨模块浏览当前 subject world 内全部 `entities` 行，并管理软删回收站。

## Shell

- 路径：`/entity`
- 导航：模块 id `entity`（`habitat_nav_entity`）
- 范围：跟随 Shell **User / Agent**（`subject_kind` → 对应 private world）

## 视图

| Tab    | 数据                     | 排序              |
| ------ | ------------------------ | ----------------- |
| 全部   | `deleted_at IS NULL`     | `updated_at DESC` |
| 回收站 | `deleted_at IS NOT NULL` | `deleted_at DESC` |

行字段：id、title、primary_component、components、时间戳。存活行可 **deleteEntity**（软删）；回收站可 **restore**。满 30 天由睡眠 cleanup **purge** 物理删除。

## Habitat RPC

| Method                   | 作用                                           |
| ------------------------ | ---------------------------------------------- |
| `entity.list`            | 存活实体分页                                   |
| `entity.trash.list`      | 回收站分页                                     |
| `entity.delete`          | 软删；无 `force` 且存在引用时返回 `references` |
| `entity.restore`         | 从回收站恢复                                   |
| `entity.deleteComponent` | 删除单个 component                             |

删除语义总表见 [`entity-model.md`](../product/entity-model.md)「Deletion semantics」。

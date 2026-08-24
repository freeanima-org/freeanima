---
title: 健康
---

# 健康（Health Record）

个人健康档案：体征、就诊、用药计划与体检报告。数据存用户**默认私有 world**（`resolvePrivateWorldId`）。

## 模型

- `primary_component = health_record`
- `body.record_kind`: `vital_sign` | `medical_visit` | `medication` | `physical_exam`
- `body.recorded_at`: 主时间轴（列表按此倒序）
- `body.readings[]`: 体征结构化读数（`metric_key` + `value`）
- `body.exam_items[]`: 检验项（含 `ref_low` / `ref_high` / 服务端计算 `flag`）
- `body.file_entity_ids[]`: 关联 `object_file` entity（PDF/影像）
- `body.related_task_id`: 用药提醒任务（可选；提醒走 task recurrence，不在 health body 自造 remind）
- `body.profile_key`: 家人档案键（默认 `self`，Phase 2 UI）

指标目录 SSOT：[`packages/shared/health/metric-catalog.ts`](../../packages/shared/health/metric-catalog.ts)

## RPC

| Method                               | 说明                                          |
| ------------------------------------ | --------------------------------------------- |
| `health.list` / `get` / `search`     | 浏览与搜索                                    |
| `health.create` / `patch` / `delete` | CRUD；写入时 `buildSummary` + `flagExamItems` |
| `health.metrics.series`              | 单指标时序点（趋势列表/图表底座）             |
| `health.attachFiles`                 | multipart 上传并追加 `file_entity_ids`        |
| `health.file.upload`                 | 仅上传 object_file（可选）                    |

## UI

- 壳路由：`/health`（Rail「健康」）
- 统一时间轴 + kind 筛选；右侧新建/编辑表单
- 附件：就诊/体检保存后 `health.attachFiles`

## 相关

- Feature：`packages/habitat/features/health/` + `packages/frontend/features/health/`
- 对象存储：[`object-storage`](object-storage.md)（`createObjectFile`）
- 任务提醒：[`task`](task.md)（`related_task_id`）

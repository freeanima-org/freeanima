---
title: 项目管理
---

# 项目管理（规格 v0.2）

逸灵风的结构化项目管理，基于[统一实体模型](../product/entity-model.md)。

**模型说明（v0.2 简化）：** 已移除里程碑与必填完成条件。项目保留日程 + 终态状态；可选背景说明放在实体 `content`（仅在项目编辑对话框中编辑）。任务仅经 `body.project_id` 关联项目。

**v1** 交付：项目文件夹树、项目实体、任务归属迁移。OKR、跨实体链接、甘特、**项目文件夹级**看板、文件资产为 **[v2+]**（任务模块 `/tasks` 看板已落地，见 [`task.md`](./task.md)）。

## 概念层级

```text
project_folder (organizational tree, independent from task_list folders)
 └── project (leaf — cannot nest)
      └── task_item (via body.project_id)
task module (/tasks) — lists, smart lists, backlog tasks (body.project_id empty)
```

项目文件夹与任务清单文件夹是**两套独立树**。任务模块仍是未派入项目条目的 **Backlog / 临时任务池**。

---

## 文件夹（`project_folder`）

仅用于项目管理的独立文件夹层级——与任务清单文件夹（`task_list.is_folder`）**不共享**。

| 规则       | 细节                                                               |
| ---------- | ------------------------------------------------------------------ |
| 嵌套       | 无限深度；纯组织                                                   |
| 无生命周期 | 无起止日期或终态状态                                               |
| 父级       | `body.parent_id` → 另一 `project_folder` 实体 id，或根为 `null`    |
| 防环       | 同任务清单文件夹——嵌套不得成环                                     |
| 删除       | 递归移除子文件夹；所含项目置 `folder_id: null`（项目**不被**删除） |

**[v2+]** 文件夹级甘特 / 看板，聚合文件夹下全部项目（任务模块看板不覆盖此范围）。

示例布局：

```text
FreeAnima (product tag or top folder name)
 ├── 0.8
 │    └── Ship 0.8.5 (project)
 └── 0.9
      └── Memory pipeline v2 (project)
```

---

## 项目（`project`）

### 基本属性

| 规则     | 细节                                                                     |
| -------- | ------------------------------------------------------------------------ |
| 叶节点   | 项目**不可嵌套**。分组用 `project_folder`                                |
| 日程     | 创建时**必填** `start_at` 与 `end_at`（或把显式结束条件编码为 `end_at`） |
| 背景     | 可选实体 `content` — 项目背景 / 说明；**不**出现在列表或任务详情面板     |
| 终态状态 | `completed` / `cancelled` / `on_hold`（另有默认 `active`）               |

**背景说明**仅在**项目编辑对话框**（`ProjectEditorDialog`）中编辑。创建对话框只收集标题 + 日程；主项目视图在页头显示日期、在列表显示任务——不显示 `content`。

**不算项目：**

- 持续产品维护（无明确结束）
- 临时杂务如「清理冰箱压缩机」（无计划日程——留在任务模块）
- `task_list` 文件夹或多个任务清单（属于**任务模块**，非项目管理）

### 项目生命周期与任务

项目进入终态或被删除时，任务处理是显式的：

| 事件                 | 任务行为（v1 默认）                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `status → completed` | **默认：留在项目内**（保留 `project_id`）。显式 `release_tasks: true` 把未完成任务移到默认清单（收件箱）。 |
| `status → cancelled` | 同 `completed`                                                                                             |
| `status → on_hold`   | 任务**保留** `project_id`；项目 UI 只读或降级编辑                                                          |
| 删除项目             | 全部任务移到**默认清单**（`is_default` 收件箱）：清空 `project_id`，设置 `list_id`                         |

非活跃项目（`on_hold` / `completed` / `cancelled`）默认在项目侧栏隐藏；可切换**显示非活跃**（同归档任务清单模式）。

项目归档语义用 **`project.status`**（及可选未来 `archived_at`）——**不要**复用 `task_list.body.closed`。任务清单归档（`closed: true`）仍是：侧栏隐藏、**禁止变更**（`清单已归档`）。

**[v2+]** 已归档项目上下文标记弱引用链；文件共归档由用户显式决定。

### 项目内内容

| 类型     | 说明                        | 归属                             |
| -------- | --------------------------- | -------------------------------- |
| 任务     | 最小执行单元；待办 / 已完成 | `body.project_id` 设置时属于项目 |
| 项目材料 | 不绑定任务的文件/文档       | **[v2+]** — 文件实体 + 项目引用  |
| 链接实体 | 日记、笔记、剪藏            | **[v2+]** — 经未来关系层弱引用   |

---

## Backlog / 任务模块（`/tasks`）

**任务模块**即既有 `/tasks` 壳路由：多个 `task_list`、文件夹树、智能清单、已归档清单。

| 规则         | 细节                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| 范围         | 「不在任何项目」表示 `task_item.body.project_id` 为 **null**                                       |
| 多清单       | 未派入项目的任务可落在**任一**普通清单（含默认清单 `is_default`，如收件箱）——不是单一 Backlog 清单 |
| 可见性       | 已设 `project_id` 的任务在任务模块列表视图中**隐藏**                                               |
| 默认清单     | 懒创建的默认清单仍是任务模块内的普通清单——**不是**任务模块与项目之间的同步收件箱                   |
| 无同步收件箱 | **没有**自动双向同步或两边都要整理的「inbox」。任一时刻任务属于**要么**任务模块**要么**某个项目    |

智能清单与已归档清单同属该模块；见 [智能清单](#智能清单)。

---

## 任务归属（任务模块 ↔ 项目）

### 核心规则

任务**一次只属于一侧**：要么任务模块（Backlog），**要么**恰好一个项目。归属在 body 字段上**互斥**。

| 动作                          | 效果                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| 从 Backlog 拖 / 移任务 → 项目 | 设 `project_id`；**清空 `list_id`**；任务从任务模块视图与清单计数中消失                       |
| 从项目移任务 → 清单           | 设 `list_id`（用户选清单）；清空 `project_id`——无「恢复上一清单」/ 移回清单                   |
| 任务从项目 A → 项目 B         | 直接转移；`list_id` 保持 null                                                                 |
| 全局搜索                      | 匹配全部任务；结果展示归属 `Backlog / {清单名}` 或 `Project / {项目标题}`；点击导航到所属表面 |

### 数据模型（`task_item` 扩展）

| 字段         | 类型             | 规则                                                                           |
| ------------ | ---------------- | ------------------------------------------------------------------------------ |
| `list_id`    | `number \| null` | 在 Backlog 时必填（`project_id` null）。**在项目内为 null**——勿保留上一清单 id |
| `project_id` | `number \| null` | 任务在项目内时设置；在 Backlog 时为 null                                       |

**不变量：**

- `list_id` / `project_id` 恰好其一非 null
- 任务模块可见 ⇔ `project_id IS NULL`（且 `list_id` 已设）
- 项目模块可见 ⇔ `project_id = {当前项目}`（且 `list_id` null）
- `list_id` 不得指向文件夹（`task_list.is_folder`）
- 清单 `item_count` 只计该 `list_id` 下的 backlog 任务（`project_id` null）

番茄专注（`pomodoro_task_focus.body.task_item_id`）不变——按任务 id 专注，与项目归属无关。

---

## 智能清单

既有 `smart_list` 实体与内置预设（今天、明天等）留在任务模块。

| 规则      | 细节                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| 默认范围  | 智能清单查询仅含 **`project_id` null** 的任务，除非过滤器显式包含 `project_id` |
| v1        | **不要**把项目内任务混入智能清单结果（与仅 Backlog 的任务模块视图一致）        |
| **[v2+]** | 按 `project_id` 过滤的预设或跨项目视图                                         |

---

## Subject 作用域（User / Agent）

对齐[实体模型壳作用域](../product/entity-model.md#app-ui-global-subject-scope)：

- `project_folder` 与 `project` 位于**当前 subject 的默认私有 world**
- 栖息地 RPC 方法接受可选 `subject_kind: user | agent`（默认 `user`，同任务）
- **v1：** 项目无跨 user/agent world 共享

---

## 搜索与 LLM 工具

| 表面                            | v1 行为                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `task.search` / `entity_search` | 结果含 `project_id`、`project_title`、`list_name`                                                                                          |
| ToolSet `project`               | 文件夹与项目 CRUD（经 `toolset_load` 加载）；`project_create` / `project_patch` 接受可选 `content` 作背景说明                              |
| ToolSet `task`                  | `task_create` / `task_update` 支持 `project_id`；`task_list` / `task_search` 按 `project_id` 过滤（与 `list_id` 互斥；默认清单仅 Backlog） |

---

## [v2+] OKR 与产品

**OKR** 位于项目之上：目标拆成关键结果；KR 经一个或多个项目落地。OKR 回答「为什么」与「多少」；项目回答「怎么做」与「何时」。

**产品**是持续命名空间（如「逸灵风」）——不是项目，不结束、不归档。**v1：** 用 `project.body.product_tag?: string` 或顶层文件夹命名；无独立产品实体。

---

## [v2+] 链接实体（外部引用）

项目可弱链接独立实体：

| 实体        | 关系     | 说明                                           |
| ----------- | -------- | ---------------------------------------------- |
| 日记        | 弱引用   | `diary_entry` 已存在；链接表或关系层 **[v2+]** |
| 笔记        | 弱引用   | 未实现                                         |
| 剪藏        | 弱引用   | 未实现                                         |
| 文件 / 照片 | 归属引用 | 文件模块未实现；删项目不删文件                 |

同一日记可链到多个项目。需要未来 `memory_references` / 关系表，见[实体模型](../product/entity-model.md#future-migration-map-not-executed-yet)。

---

## [v2+] 材料与文件

文件与照片是全局资产，项目只是引用入口之一。删项目不删文件。引用的归档行为由用户显式决定。

---

## 与任务模块的关系

| 方面     | 决策                                                 |
| -------- | ---------------------------------------------------- |
| 文件夹树 | **分开** — `project_folder` vs `task_list.is_folder` |
| 任务模块 | **保留** — Backlog + 临时池                          |
| 收敛     | 若 Backlog 使用减少再重新考虑；**不要**预先合并模块  |

---

## UI（v1 界面）

| 路由        | 布局                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `/projects` | 文件夹树 + 项目任务列表 + 任务详情面板（响应式 `ThreeColumnLayout`）；**无**里程碑栏或里程碑对话框 |
| `/tasks`    | 不变；隐藏 `project_id` 任务                                                                       |

项目**背景说明**（`entity.content`）仅在项目编辑对话框中编辑——不在侧栏、项目页头或任务列表。

两者经 `subject_kind` 继承壳 **User / Agent** 切换。

---

## 迁移（v1）

- 既有任务：`project_id` 缺省 / null — 行为不变
- **简化模型迁移：** 删除 `milestone` 实体，清空 `task_item.body.milestone_id`，移除 `project.body.completion_criteria`；当 `entity.content` 为空时，从原 `completion_criteria` 回填
- 新组件注册到实体组件索引

---

## 非目标（v1）

首版实现**明确范围外**：

- OKR 实体与 KR → 项目映射
- 甘特 / **文件夹级**看板（跨项目聚合）；任务模块看板见 [`task.md`](./task.md)
- 笔记、剪藏、文件/照片库与项目材料上传
- 跨实体引用 UI 与已归档引用上下文
- 栖息地管理台项目表面
- 跨 user/agent world 项目共享

---

## 数据模型附录

实体类型：`content`。注明处文本字段用实体列。

### `project_folder`

| 位置   | 字段         | 类型           | 说明            |
| ------ | ------------ | -------------- | --------------- |
| entity | `title`      | string         | 文件夹名        |
| body   | `parent_id`  | number \| null | 父文件夹实体 id |
| body   | `sort_order` | number         | 同级顺序        |

### `project`

| 位置   | 字段          | 类型           | 说明                                                |
| ------ | ------------- | -------------- | --------------------------------------------------- |
| entity | `title`       | string         | 项目名                                              |
| entity | `content`     | string         | 可选背景 / 说明（UI 仅编辑对话框）                  |
| body   | `folder_id`   | number \| null | 父文件夹                                            |
| body   | `start_at`    | string         | ISO 8601                                            |
| body   | `end_at`      | string         | ISO 8601                                            |
| body   | `status`      | enum           | `active` \| `completed` \| `cancelled` \| `on_hold` |
| body   | `product_tag` | string         | 可选 v1 产品标签                                    |
| body   | `sort_order`  | number         | 文件夹内同级                                        |

### `task_item`（扩展）

| 位置 | 字段         | 类型           | 说明                                         |
| ---- | ------------ | -------------- | -------------------------------------------- |
| body | `project_id` | number \| null | 在项目内时设置                               |
| body | `list_id`    | number         | 既有；见 [任务归属](#任务归属任务模块--项目) |

---

## 离线（CRUD outbox）

卫星壳 Project UI 走 IndexedDB 快照 + outbox（与日记 / 任务同级）。写 RPC 支持可选 `client_op_id` 幂等；详见 [`offline-platform.md`](../aspects/offline-platform.md)。

---

## 栖息地 RPC 方法（v1）

全部方法可选 `subject_kind: user | agent`（默认 `user`）。传输：`POST|WS /rpc/v1`。

### `projectfolder.*`

| 方法                   | 用途                                               |
| ---------------------- | -------------------------------------------------- |
| `projectfolder.list`   | 列文件夹树（含嵌套或带 `parent_id` 扁平）          |
| `projectfolder.create` | 创建文件夹（`parent_id?`、`title`、`sort_order?`） |
| `projectfolder.patch`  | 重命名、改父、重排                                 |
| `projectfolder.delete` | 删除文件夹树；项目 → `folder_id: null`             |

### `project.*`

| 方法             | 用途                                                                           |
| ---------------- | ------------------------------------------------------------------------------ |
| `project.list`   | 列项目（`folder_id?`、`status?`）                                              |
| `project.stats`  | 侧栏徽章用每项目 `task_count`（`folder_id?`、`status?`）                       |
| `project.create` | 创建项目（必填 `title`、`start_at`、`end_at`；可选 `content`、`folder_id`、…） |
| `project.get`    | 项目详情                                                                       |
| `project.patch`  | 更新字段（含可选 `content`）、终态状态，或 `release_tasks` 副作用              |
| `project.delete` | 删除项目；任务移到默认清单（收件箱）                                           |

### 任务条目栖息地方法（归属拆分）

| 方法                                      | 用途                                             |
| ----------------------------------------- | ------------------------------------------------ |
| `tasklist.item.list`                      | 任务模块列任务（清单 / Backlog；默认排除项目内） |
| `tasklist.item.create`                    | 任务模块建任务（只认 `list_id`，可省略→收件箱）  |
| `project.item.list`                       | 项目模块列任务（必填 `project_id`）              |
| `project.item.create`                     | 项目模块建任务（只认 `project_id`）              |
| `task.moveToProject`                      | 显式移入项目（清空 `list_id`）                   |
| `task.moveToList`                         | 显式移回清单（清空 `project_id`）                |
| `task.patch`                              | 仅内容字段（标题/优先级/截止等；不含归属）       |
| `task.search`                             | 跨归属搜索；结果含 project/list 归属             |
| `task.complete` / `uncomplete` / `delete` | 按 id 共享操作                                   |

实现目标：`packages/habitat/features/project/`（domain + habitat + `plugin.ts`）与 `packages/frontend/features/project/`（`ui/spa`）；schema 在 `packages/habitat/core/db/schema/entity/components/`；SAP frames 在 `packages/shared/rpc-contract/frames/`。

另见[实体模型 — 项目模块](../product/entity-model.md#project-module-v1-spec)。

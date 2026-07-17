---
title: Project Management
---

# Project Management (spec v0.2)

Structured project management for FreeAnima, based on the [Unified Entity Model](../concepts/entity-model.md). **v1** delivers: project folder tree, project entity, task ownership migration, and milestones. OKR, cross-entity links, Gantt/Kanban, and file assets are **[v2+]** (see [Non-goals (v1)](#non-goals-v1)).

## Concept hierarchy

```text
project_folder (organizational tree, independent from task_list folders)
 └── project (leaf — cannot nest)
      ├── milestone (time anchors inside the project)
      └── task_item (via body.project_id; optional body.milestone_id)
task module (/tasks) — lists, smart lists, backlog tasks (body.project_id empty)
```

Project folders and task-list folders are **separate trees**. The task module remains the **Backlog / ad-hoc task pool** for items not assigned to a project.

---

## Folders (`project_folder`)

Independent folder hierarchy for project management only — **not shared** with task-list folders (`task_list.is_folder`).

| Rule             | Detail                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Nesting          | Unlimited depth; pure organization                                                                       |
| No lifecycle     | No start/end dates, completion criteria, or terminal status                                              |
| Parent           | `body.parent_id` → another `project_folder` entity id, or `null` at root                                 |
| Cycle prevention | Same as task-list folders — nesting must not form cycles                                                 |
| Delete           | Recursively removes sub-folders; contained projects get `folder_id: null` (projects are **not** deleted) |

**[v2+]** Folder-level Gantt / Kanban views aggregating all projects under the folder.

Example layout:

```text
FreeAnima (product tag or top folder name)
 ├── 0.8
 │    └── Ship 0.8.5 (project)
 └── 0.9
      └── Memory pipeline v2 (project)
```

---

## Projects (`project`)

### Basic attributes

| Rule                | Detail                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Leaf node           | Projects **cannot nest**. Use `project_folder` for grouping                                               |
| Schedule            | **Required** `start_at` and `end_at` (or explicit end condition encoded as `end_at`) at create time       |
| Completion criteria | **Required** at create — what counts as "done" (stored in entity `content` or `body.completion_criteria`) |
| Terminal status     | `completed` / `cancelled` / `on_hold` (plus default `active`)                                             |

**Not a project:**

- Ongoing product maintenance (no defined end)
- Ad-hoc chores such as "clean fridge compressor" (no planned schedule or completion criteria — stays in the task module)
- `task_list` folders or multiple task lists (those belong to the **task module**, not project management)

### Project lifecycle and tasks

When a project reaches a terminal state or is deleted, task handling is explicit:

| Event                | Task behavior (v1 default)                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `status → completed` | **Default: keep in project** (`project_id` retained). Explicit `release_tasks: true` moves pending tasks to the default list (Inbox).       |
| `status → cancelled` | Same as `completed`                                                                                                                         |
| `status → on_hold`   | Tasks **keep** `project_id`; project UI read-only or degraded edit                                                                          |
| Delete project       | All tasks move to the **default list** (`is_default` Inbox): `project_id`/`milestone_id` cleared, `list_id` set; milestone entities deleted |

Inactive projects (`on_hold` / `completed` / `cancelled`) are hidden from the project sidebar by default; toggle **显示非活跃** (same pattern as archived task lists).

Project archive semantics use **`project.status`** (and optional future `archived_at`) — **do not** reuse `task_list.body.closed`. Task-list archive (`closed: true`) remains: sidebar hidden, **mutations forbidden** (`清单已归档`).

**[v2+]** Archived project context marks weak reference chains; file co-archive is user-explicit.

### Contents inside a project

| Type              | Description                                  | Ownership                                           |
| ----------------- | -------------------------------------------- | --------------------------------------------------- |
| Task              | Smallest execution unit; pending / completed | Belongs to project when `body.project_id` is set    |
| Project materials | Files/docs not tied to a task                | **[v2+]** — file entity + project reference         |
| Linked entities   | Diary, notes, clips                          | **[v2+]** — weak refs via future relationship layer |

---

## Backlog / task module (`/tasks`)

The **task module** is the existing `/tasks` Shell route: multiple `task_list`s, folder tree, Smart Lists, and archived lists.

| Rule          | Detail                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope         | "Not in any project" means `task_item.body.project_id` is **null**                                                                                          |
| Multi-list    | Unassigned tasks may live in **any** normal list (including the default list `is_default`, e.g. Inbox) — not a single Backlog list                          |
| Visibility    | Tasks with `project_id` set are **hidden** from task-module list views                                                                                      |
| Default list  | The lazy-created default list remains a normal list inside the task module — it is **not** a sync inbox between task module and projects                    |
| No sync inbox | There is **no** auto two-way sync or "inbox" that requires tidying on both sides. Tasks belong to **either** the task module **or** a project at any moment |

Smart Lists and archived lists follow the same module; see [Smart Lists](#smart-lists).

---

## Task ownership (task module ↔ project)

### Core rule

A task belongs to **one side at a time**: either the task module (Backlog) **or** exactly one project. Ownership is **mutually exclusive** on the body fields.

| Action                                  | Effect                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Drag / move task from Backlog → project | Set `project_id`; **clear `list_id`**; task disappears from task-module views and list counts                                     |
| Move task from project → list           | Set `list_id` (user picks list); clear `project_id` and `milestone_id` — there is no "restore previous list" / 移回清单           |
| Move task project A → project B         | Direct transfer; **clear `milestone_id`**; `list_id` stays null                                                                   |
| Global search                           | Matches all tasks; result shows归属 `Backlog / {list name}` or `Project / {project title}`; click navigates to the owning surface |

### Data model (extensions to `task_item`)

| Field          | Type             | Rule                                                                                                        |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `list_id`      | `number \| null` | Required when in Backlog (`project_id` null). **Null when in a project** — do not retain last list id       |
| `project_id`   | `number \| null` | Set when task is in a project; null when in Backlog                                                         |
| `milestone_id` | `number \| null` | Optional; must reference a milestone in the **same** project; cleared on cross-project move or move to list |

**Invariants:**

- Exactly one of `list_id` / `project_id` is non-null
- Task-module visibility ⇔ `project_id IS NULL` (and `list_id` set)
- Project-module visibility ⇔ `project_id = {current project}` (and `list_id` null)
- `list_id` must not point at a folder (`task_list.is_folder`)
- `milestone_id` implies `project_id` is set and matches the milestone's project
- Deleting a milestone does **not** delete tasks — only clears or invalidates `milestone_id`
- List `item_count` counts only backlog tasks (`project_id` null) for that `list_id`

Pomodoro focus (`pomodoro_task_focus.body.task_item_id`) is unchanged — focus is by task id regardless of project归属.

---

## Smart Lists

Existing `smart_list` entities and built-in presets (Today, Tomorrow, etc.) remain in the task module.

| Rule          | Detail                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Default scope | Smart List queries include only tasks with **`project_id` null**, unless the filter explicitly includes `project_id` |
| v1            | Do **not** mix in-project tasks into Smart List results (consistent with Backlog-only task-module views)             |
| **[v2+]**     | Presets filtered by `project_id` or cross-project views                                                              |

---

## Milestones (`milestone`)

Time anchors **inside** a project. Milestones do **not** own tasks — tasks may optionally link via `task_item.body.milestone_id`.

| Field        | Detail                                              |
| ------------ | --------------------------------------------------- |
| `project_id` | Parent project entity id                            |
| `due_at`     | ISO 8601 deadline                                   |
| `status`     | `pending` / `in_progress` / `completed` / `delayed` |
| `sort_order` | Order within the project                            |

**Delayed:** auto when `due_at < now` and `status != completed`; manual override allowed.

Unlike OKR Key Results (end-of-period assessment), milestones are marked **during** execution ("where we are on the way").

---

## Subject scope (User / Agent)

Aligned with [entity-model Shell scope](../concepts/entity-model.md#shell-ui-global-subject-scope):

- `project_folder`, `project`, and `milestone` live in the **current subject's default private world**
- Hub RPC methods accept optional `subject_kind: user | agent` (default `user`, same as tasks)
- **v1:** no cross user/agent world sharing for projects

---

## Search and LLM tools

| Surface                         | v1 behavior                                                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task.search` / `entity_search` | Include `project_id`, `project_title`, `list_name` in results                                                                                                                             |
| ToolSet `project`               | CRUD for folders, projects, milestones (load via `toolset_load`)                                                                                                                          |
| ToolSet `task`                  | `task_create` / `task_update` support `project_id` / `milestone_id`; `task_list` / `task_search` filter by `project_id` (mutually exclusive with `list_id`; default list is Backlog only) |

---

## [v2+] OKR and products

**OKR** sits above projects: an Objective splits into Key Results; KRs land via one or more projects. OKR answers _why_ and _how much_; projects answer _how_ and _when_.

**Product** is a ongoing namespace (e.g. "FreeAnima") — not a project, does not end or archive. **v1:** use `project.body.product_tag?: string` or top-level folder naming; no separate product entity.

---

## [v2+] Linked entities (external references)

Projects may weak-link independent entities:

| Entity       | Relation        | Notes                                                                  |
| ------------ | --------------- | ---------------------------------------------------------------------- |
| Diary        | Weak ref        | `diary_entry` exists today; link table or relationship layer **[v2+]** |
| Note         | Weak ref        | Not implemented                                                        |
| Clip         | Weak ref        | Not implemented                                                        |
| File / photo | Attribution ref | File module not implemented; delete project does not delete files      |

Same diary may link to multiple projects. Requires future `memory_references` / relationship table per [entity-model](../concepts/entity-model.md#future-migration-map-not-executed-yet).

---

## [v2+] Materials and files

Files and photos are global assets with project as one reference entry. Deleting a project does not delete files. Archive behavior for references is user-explicit.

---

## Relationship to the task module

| Aspect       | Decision                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| Folder trees | **Separate** — `project_folder` vs `task_list.is_folder`                 |
| Task module  | **Retained** — Backlog + ad-hoc pool                                     |
| Convergence  | If Backlog usage shrinks, reconsider later; **do not** pre-merge modules |

---

## UI (v1)

| Route       | Layout                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| `/projects` | Three columns: project folder tree + project detail (tasks) + milestones |
| `/tasks`    | Unchanged; hides `project_id` tasks                                      |

Both inherit Shell **User / Agent** toggle via `subject_kind`.

---

## Migration (v1)

- Existing tasks: `project_id` and `milestone_id` absent / null — behavior unchanged
- No backfill beyond new optional JSONB fields on `task_item.body`
- New components registered in entity component index; no legacy table migration

---

## Non-goals (v1)

Explicit **out of scope** for the first implementation:

- OKR entities and KR → project mapping
- Gantt / Kanban (including folder-level cross-project views)
- Notes, clips, file/photo library and project material uploads
- Cross-entity reference UI and archived reference context
- Console admin surfaces for projects
- Cross user/agent world project sharing

---

## Data model appendix

Entity type: `content`. Text fields use entity columns where noted.

### `project_folder`

| Location | Field        | Type           | Notes                   |
| -------- | ------------ | -------------- | ----------------------- |
| entity   | `title`      | string         | Folder name             |
| body     | `parent_id`  | number \| null | Parent folder entity id |
| body     | `sort_order` | number         | Sibling order           |

### `project`

| Location | Field                 | Type           | Notes                                               |
| -------- | --------------------- | -------------- | --------------------------------------------------- |
| entity   | `title`               | string         | Project name                                        |
| entity   | `content`             | string         | Completion criteria (or body field below)           |
| body     | `folder_id`           | number \| null | Parent folder                                       |
| body     | `start_at`            | string         | ISO 8601                                            |
| body     | `end_at`              | string         | ISO 8601                                            |
| body     | `completion_criteria` | string         | Optional if using entity `content`                  |
| body     | `status`              | enum           | `active` \| `completed` \| `cancelled` \| `on_hold` |
| body     | `product_tag`         | string         | Optional v1 product label                           |
| body     | `sort_order`          | number         | Among siblings in folder                            |

### `milestone`

| Location | Field        | Type   | Notes                                                  |
| -------- | ------------ | ------ | ------------------------------------------------------ |
| entity   | `title`      | string | Milestone name                                         |
| body     | `project_id` | number | Parent project                                         |
| body     | `due_at`     | string | ISO 8601                                               |
| body     | `status`     | enum   | `pending` \| `in_progress` \| `completed` \| `delayed` |
| body     | `sort_order` | number | Within project                                         |

### `task_item` (extensions)

| Location | Field          | Type           | Notes                                                                |
| -------- | -------------- | -------------- | -------------------------------------------------------------------- |
| body     | `project_id`   | number \| null | Set when in project                                                  |
| body     | `milestone_id` | number \| null | Optional; same project as `project_id`                               |
| body     | `list_id`      | number         | Existing; see [Task ownership](#task-ownership-task-module--project) |

---

## Offline (Tier 2-CRUD)

卫星壳 Project UI 走 IndexedDB 快照 + outbox（与 Diary / Task 同级）。写 RPC 支持可选 `client_op_id` 幂等；详见 [`offline-platform.md`](../guide/offline-platform.md)。

---

## Hub RPC methods (v1)

All methods optional `subject_kind: user | agent` (default `user`). Transport: `POST|WS /hub/rpc/v1`.

### `projectfolder.*`

| Method                 | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `projectfolder.list`   | List folder tree (`include nested` or flat with `parent_id`) |
| `projectfolder.create` | Create folder (`parent_id?`, `title`, `sort_order?`)         |
| `projectfolder.patch`  | Rename, reparent, reorder                                    |
| `projectfolder.delete` | Delete folder tree; projects → `folder_id: null`             |

### `project.*`

| Method           | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `project.list`   | List projects (`folder_id?`, `status?`)                                       |
| `project.create` | Create project (required schedule + completion criteria)                      |
| `project.get`    | Project detail + task/milestone counts                                        |
| `project.patch`  | Update fields or terminal status (with task side-effects per lifecycle table) |
| `project.delete` | Delete project; tasks move to default list (Inbox)                            |

### `milestone.*`

| Method             | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `milestone.list`   | List by `project_id`                                 |
| `milestone.create` | Create milestone                                     |
| `milestone.patch`  | Update status, due, order                            |
| `milestone.delete` | Delete milestone; tasks keep, `milestone_id` cleared |

### Task item Hub methods（归属拆分）

| Method                                    | Purpose                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `tasklist.item.list`                      | 任务模块列任务（清单 / Backlog；默认排除项目内）         |
| `tasklist.item.create`                    | 任务模块建任务（只认 `list_id`，可省略→收件箱）          |
| `project.item.list`                       | 项目模块列任务（必填 `project_id`）                      |
| `project.item.create`                     | 项目模块建任务（只认 `project_id`，可选 `milestone_id`） |
| `task.moveToProject`                      | 显式移入项目（清空 `list_id`）                           |
| `task.moveToList`                         | 显式移回清单（清空 `project_id` / `milestone_id`）       |
| `task.patch`                              | 仅内容字段（标题/优先级/截止/`milestone_id` 等）         |
| `task.search`                             | 跨归属搜索；结果含 project/list 归属                     |
| `task.complete` / `uncomplete` / `delete` | 按 id 共享操作                                           |

Implementation target: `src/features/project/` (domain + hub + `ui/spa` + `plugin.ts`); schemas under `src/core/db/schema/entity/components/`; SAP frames under `src/shared/sap-contract/frames/`.

See also [entity-model — Project module](../concepts/entity-model.md#project-module-v1-spec).

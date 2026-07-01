---
title: Entity Model
---

# Unified Entity Model (v0.8)

FreeAnima stores most structured business data in a single **`entities`** table. Self layer remains physically isolated in [`self_blocks`](self-layer.md).

## Hierarchy: subject → world → content

| Layer       | Entity type     | Role                                                |
| ----------- | --------------- | --------------------------------------------------- |
| **Subject** | `agent`, `user` | Who acts — exists **before** and **outside** worlds |
| **World**   | `world`         | Logical namespace / permission boundary             |
| **Content** | `content`       | Business data (tasks, future memory components, …)  |

Subjects do **not** belong to a world. Each subject may have exactly **one default private world** (exclusive, auto-created on subject creation). Content belongs to a world via `world_id` and inherits that world's visibility boundary.

## Two orthogonal classifications

| Layer           | Cardinality              | Purpose                                                    |
| --------------- | ------------------------ | ---------------------------------------------------------- |
| **Entity type** | 4 fixed values           | Architecture boundary: `content`, `world`, `agent`, `user` |
| **Components**  | Dynamic, many per entity | Functional markers: `task_list`, `task_item`, …            |

Component fields live in **`body` JSONB** at the top level. **`primary_component`** records the creation entry (usually immutable); list views route by primary component.

## `entities` table

| Column                          | Role                                         |
| ------------------------------- | -------------------------------------------- |
| `id`                            | `bigint` identity — global numeric ID        |
| `type`                          | One of four entity types                     |
| `world_id`                      | Native owning World (FK → `entities.id`)     |
| `components`                    | `text[]` component tags                      |
| `primary_component`             | Main component for module routing            |
| `title` / `summary` / `content` | Shared text columns (all components may use) |
| `body`                          | JSONB component payload                      |
| `created_at` / `updated_at`     | Timestamps                                   |

**Not in v0.8 bootstrap:** relationship table, permission table, World nesting/mount, graph DB (PostgreSQL AGE).

## Subject (`agent` / `user`)

- Identity is **`type`** plus `agent_config` or `user_config` primary component.
- Subjects are **not** scoped by `world_id` in a membership sense; row `world_id` stays at bootstrap root (`ENTITY_ROOT_WORLD_ID`) as a table placeholder.
- **`agent_config` / `user_config` body**: `default_private_world_id` — the subject's single default private world (auto-created on subject create; configurable from private worlds owned by the subject).
- **Notifications** use subject entity ids as `recipient_id` (see [`notifications.md`](notifications.md) and `config.yaml` `worlds.user_subject_id` / `agent_subject_id`).
- **Service API Token**（`service_api_tokens` 表）绑定 subject entity id；Hub REST/SAP/MCP 从 Bearer token 解析调用方身份。见 [`remote-access.md`](../guide/remote-access.md)。

### Boot-time ensure (`worlds` config)

Hub startup runs **`ensureWorldSubjects()`** once (after migrations, before engine):

- Ensures configured (or default `user=1` / `agent=2`) subject entities exist with correct `type`.
- Ensures each subject has a **default private world** (`default_private_world_id`); private world ids are **not fixed**.
- Binds **`ResolvedWorldContext`** in memory: `user_subject_id`, `agent_subject_id`, `user_world_id`, `agent_world_id`.
- Type conflict (configured id exists but wrong `type`) **aborts service startup**.

Legacy SQL bootstrap seeds (public world id=1, Inbox id=2) are removed by migration; default data is **code-owned**, not migration-seeded.

## World namespace

- **`type: world`** entities are logical containers (permission/list boundary).
- Visibility and owner live in **`world_config` body**:
  - `private: false` — public world
  - `private: true` + `owner_subject_id` — private world owned by an `agent` or `user` entity
  - `default_private: true` — marks the subject's **exclusive** default private world (at most one per `owner_subject_id`)
- Do not confuse with semantic memory **`type=world`** (fact classification in [`memory.md`](memory.md)) — that becomes `body.memory_kind=world` after future migration.

## Content

- **`world_id`** is the sole namespace key; access boundary is inherited from the owning world.
- Content entities do not store a separate owner column.

## Task module (first consumer)

TickTick-style lists and items map to:

| Concept     | Entity         | Component      |
| ----------- | -------------- | -------------- |
| Task domain | `type=world`   | `world_config` |
| List        | `type=content` | `task_list`    |
| Item (task) | `type=content` | `task_item`    |

Items reference their list via `body.list_id` (entity id). Task items store **title** and **content** on entity columns; **tags** live in `body.tags`. Each world gets a **default list** (`is_default: true`, name e.g.「收件箱」) **lazily** on first task use (`ensureDefaultTaskListForWorld`); it cannot be deleted or archived but may be renamed. List **`body.closed: true`** means archived: hidden from the main sidebar by default (`tasklist.list` unless `include_closed`), restorable via `tasklist.patch({ closed: false })`; contained task items are kept.

Task/list tools and stores require explicit **`world_id`** (typically `user_world_id` from system prompt / `GET /api/worlds/context`).

**Folders** (`body.is_folder: true`) are container nodes in the sidebar tree only — they cannot hold tasks directly (`task.create` / `task.patch` reject `list_id` pointing at a folder). Child lists and sub-folders reference a parent folder via `body.parent_id` (entity id of a folder, or omitted/null at root). Nesting must not form cycles. **Folders cannot be archived** — only deleted. Deleting a folder recursively removes all sub-folders and moves every contained list to root (`parent_id: null`); list task items are kept. List **`body.closed: true`** means archived (lists only): hidden from the main sidebar by default (`tasklist.list` unless `include_closed`), restorable via `tasklist.patch({ closed: false })` only; **any other mutation on an archived list or its tasks** (rename, move, edit, complete, …) returns `清单已归档`. Deleting a non-folder list removes its task items when `cascade` is true (default). `sort_order` is scoped among siblings sharing the same `parent_id`.

LLM ToolSets: `@freeanima/capabilities-task` — `task` (item CRUD + `task_search`) and `tasklist` (list CRUD + `tasklist_search`); load via `toolset_load`. `task_search` searches all lists when `list_id` is omitted. Legacy `tasks` table and `/api/tasks/*` are removed after one-time migration ([`scripts/archive/migrate-tasks-to-entities.ts`](../../scripts/archive/migrate-tasks-to-entities.ts)).

### Shell UI: global Subject scope

Hub startup binds **`ResolvedWorldContext`** (`GET /api/worlds/context`). The product shell exposes a **single User / Agent toggle** in the module header — not an arbitrary `world_id` picker. Selection maps to `user_world_id` / `agent_world_id` and persists in `sessionStorage` for the tab.

| Surface          | World binding                                    | Control                        |
| ---------------- | ------------------------------------------------ | ------------------------------ |
| Shell header     | `user_world_id` or `agent_world_id`              | global **User / Agent** toggle |
| `/tasks`         | follows shell scope via SAP `subject_kind`       | none (inherits header)         |
| `/email`         | follows shell scope via SAP `subject_kind`       | none (inherits header)         |
| `/notifications` | `recipient_kind` + subject entity id             | none (inherits header)         |
| `/diary`         | subject default private world via `subject_kind` | none (inherits header)         |

SAP task/email methods accept optional `subject_kind` (defaults: task `user`, email `agent`). Satellites read the shell scope via **`useSubjectScope()`** from `@freeanima/shell-sdk`; Hub REST entity search uses **`resolveWorldIdForSubject()`** with the same scope.

Future multi-world browse (e.g. diary calendar aggregation across worlds) should add **module-scoped** filters or Admin tooling — not a speculative arbitrary world picker.

## Email module (Estate)

Email accounts, threads, and mirrored messages map to:

| Concept | Entity         | Component       |
| ------- | -------------- | --------------- |
| Account | `type=content` | `email_account` |
| Thread  | `type=content` | `email_thread`  |
| Message | `type=content` | `email_message` |

Accounts store SMTP/IMAP settings and sync cursor in `body.sync`. Messages store IMAP UID in `body.imap_uid`; human-readable subject/body use entity columns. IMAP sync upserts threads/messages; UI lives in shell `/email` (SAP `email.*` methods), not Admin REST.

LLM ToolSets: `@freeanima/capabilities-email` — `email-account` (account entities) and `email` (sync, send/receive, search); load via `toolset_load`. Legacy `config.yaml` `email.accounts[]` migrates via [`scripts/archive/migrate-email-to-entities.ts`](../../scripts/archive/migrate-email-to-entities.ts).

## Diary module

Structured journal entries for **user** and **agent** subjects:

| Concept | Entity         | Component     |
| ------- | -------------- | ------------- |
| Entry   | `type=content` | `diary_entry` |

Entries live in each subject's **`default_private_world_id`**. `body.entry_at` is the timeline sort key; `title` / `summary` / `content` use entity columns; optional `body.tags`.

- **SAP:** `diary.*` methods — all take `subject_kind: user | agent` (including `diary.append`).
- **UI:** shell `/diary` (`@freeanima/satellite-diary`).
- **LLM:** ToolSet `diary` — agent private world only.

See [`docs/features/diary.md`](../features/diary.md).

## Search

Entity **list** (deterministic browse) and **search** (relevance ranking) are separate ports:

| Port                      | Role                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `EntityStorePort.list`    | Structural filters; stable sort                                       |
| `EntitySearchPort.search` | Hard filters + optional text query; hybrid FTS/trigram/vector via RRF |

**Scope:** default `world_id`; `global: true` requires an explicit accessible-world allowlist (public worlds only until subject permissions bootstrap).

**Component filters:** whitelisted per `primary_component` (e.g. `task_item`: `status`, `list_id`, `tags`, `due_today`). Arbitrary JSONPath is forbidden.

**Tools / API:** `entity_search` (LLM/MCP) and `GET|POST /api/entities/search` share `EntitySearchPort`. Task UI search box uses the same REST endpoint.

See memory hybrid search in [`memory.md`](memory.md) for FTS operator syntax; entity search reuses the same query builder.

**FTS index:** same `fts_segmented` + jieba write path as semantic memory (`resolveFtsSegmentedForWrite` on entity create/update). Legacy rows imported before this column may lack segmentation; run Admin **FTS** rebuild (`onlyMissing`) to backfill `entities.fts_segmented` so jieba query tokens align with the GIN index.

## Future migration map (not executed yet)

| Legacy table                 | Target                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `semantic_memory`            | `content` + memory component                                                                                               |
| `autobiographical_memory`    | `content` + narrative component                                                                                            |
| `limbic_memory`              | `content` + limbic component                                                                                               |
| `tasks` (legacy)             | `task_item` (when explicitly migrated)                                                                                     |
| `config.yaml email.accounts` | `email_account` (see [`scripts/archive/migrate-email-to-entities.ts`](../../scripts/archive/migrate-email-to-entities.ts)) |
| `memory_references`          | relationship table (future)                                                                                                |

See [`architecture.md`](architecture.md) for cognitive-layer context.

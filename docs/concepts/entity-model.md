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
| List (清单) | `type=content` | `task_list`    |
| Item (任务) | `type=content` | `task_item`    |

Items reference their list via `body.list_id` (entity id). Task items store **title** and **content** on entity columns; **tags** live in `body.tags`. A **default list** (`is_default: true`, seeded id `2`「收件箱」) cannot be deleted but may be renamed.

LLM tools use `@freeanima/capabilities-task` (`task_*` tools, `exposeMcp: true`). Legacy `tasks` table and `/api/tasks/*` are removed after one-time migration (`scripts/migrate-tasks-to-entities.ts`).

## Email module (Estate)

Email accounts, threads, and mirrored messages map to:

| Concept | Entity         | Component       |
| ------- | -------------- | --------------- |
| Account | `type=content` | `email_account` |
| Thread  | `type=content` | `email_thread`  |
| Message | `type=content` | `email_message` |

Accounts store SMTP/IMAP settings and sync cursor in `body.sync`. Messages store IMAP UID in `body.imap_uid`; human-readable subject/body use entity columns. IMAP sync upserts threads/messages; UI lives in shell `/email` (SAP `email.*` methods), not Admin REST.

LLM tools: `@freeanima/capabilities-email` (`email_register_account`, `email_sync`, `email_list`, …). Legacy `config.yaml` `email.accounts[]` migrates via `scripts/migrate-email-to-entities.ts`.

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

| Legacy table                 | Target                                               |
| ---------------------------- | ---------------------------------------------------- |
| `semantic_memory`            | `content` + memory component                         |
| `autobiographical_memory`    | `content` + narrative component                      |
| `limbic_memory`              | `content` + limbic component                         |
| `tasks` (legacy)             | `task_item` (when explicitly migrated)               |
| `config.yaml email.accounts` | `email_account` (see `migrate-email-to-entities.ts`) |
| `memory_references`          | relationship table (future)                          |

See [`architecture.md`](architecture.md) for cognitive-layer context.

---
title: Entity Model
---

# Unified Entity Model (v0.8)

FreeAnima stores most structured business data in a single **`entities`** table. Self layer remains physically isolated in [`self_blocks`](self-layer.md).

## Two orthogonal classifications

| Layer           | Cardinality              | Purpose                                                    |
| --------------- | ------------------------ | ---------------------------------------------------------- |
| **Entity type** | 4 fixed values           | Architecture boundary: `content`, `world`, `agent`, `user` |
| **Components**  | Dynamic, many per entity | Functional markers: `task_list`, `task_item`, …            |

Component fields live in **`body` JSONB** at the top level. **`primary_component`** records the creation entry (usually immutable); list views route by primary component.

## `entities` table

| Column                      | Role                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `id`                        | `bigint` identity — global numeric ID                                |
| `type`                      | One of four entity types                                             |
| `world_id`                  | Native owning World (FK → `entities.id`)                             |
| `owner_id`                  | Owning subject (`agent` / `user` entity), nullable for public worlds |
| `components`                | `text[]` component tags                                              |
| `primary_component`         | Main component for module routing                                    |
| `body`                      | JSONB component payload                                              |
| `created_at` / `updated_at` | Timestamps                                                           |

**Not in v0.8 bootstrap:** relationship table, permission table, World nesting/mount, graph DB (PostgreSQL AGE).

## World namespace

- **`type: world`** entities are logical containers (permission/list boundary).
- Public world: `owner_id = null`.
- Do not confuse with semantic memory **`type=world`** (fact classification in [`memory.md`](memory.md)) — that becomes `body.memory_kind=world` after future migration.

## Task module (first consumer)

TickTick-style lists and items map to:

| Concept     | Entity         | Component      |
| ----------- | -------------- | -------------- |
| Task domain | `type=world`   | `world_config` |
| List (清单) | `type=content` | `task_list`    |
| Item (任务) | `type=content` | `task_item`    |

Items reference their list via `body.list_id` (entity id).

### Coexistence with legacy `tasks` table

The original cross-conversation todo system (`tasks` table, `@freeanima/capabilities-tasks`, `/api/tasks/*`, LLM tools, fridge summary) **remains unchanged**. Shell UI **`/tasks`** uses the new entity stack (`/api/task/*`, `@freeanima/capabilities-task`).

## Future migration map (not executed yet)

| Legacy table              | Target                                 |
| ------------------------- | -------------------------------------- |
| `semantic_memory`         | `content` + memory component           |
| `autobiographical_memory` | `content` + narrative component        |
| `limbic_memory`           | `content` + limbic component           |
| `tasks` (legacy)          | `task_item` (when explicitly migrated) |
| `memory_references`       | relationship table (future)            |

See [`architecture.md`](architecture.md) for cognitive-layer context.

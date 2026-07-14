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

**Not in v0.8 bootstrap:** relationship table, World nesting/mount, graph DB (PostgreSQL AGE). Subject↔world grants live in `world_config.grants` (no separate permission table).

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
- Visibility, owner, and grants live in **`world_config` body**:
  - `private: false` — public world
  - `private: true` + `owner_subject_id` — private world owned by an `agent` or `user` entity
  - `default_private: true` — marks the subject's **exclusive** default private world (at most one per `owner_subject_id`)
  - `grants: [{ subject_id, permission: "read" | "write" }]` — explicit subject grants (**write includes read**; `subject_id` must not equal owner). Configured in Console Worlds UI; never hardcoded per subject in source.
- **Access rules** (MCP / LLM tools via `resolveToolWorld`):

  | World   | Read                   | Write                    |
  | ------- | ---------------------- | ------------------------ |
  | public  | all subjects           | owner **or** write grant |
  | private | owner **or** any grant | owner **or** write grant |

- Owner always has full access without a grant row. Cross-world tool calls must use grants — open-source builds must not special-case subject ids.
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

Task/list **LLM 工具**默认在 **agent subject 专属 private world** 操作，多数调用可省略 `world_id`；按 `id` / `list_id` 操作时从实体反查 world 并校验 caller 权限。**MCP** 工具默认 scope 为 token 绑定 subject 的 private world。Shell SAP/REST 仍通过 `subject_kind` 选择 user/agent world（见下表）。

**Folders** (`body.is_folder: true`) are container nodes in the sidebar tree only — they cannot hold tasks directly (`task.create` / `task.patch` reject `list_id` pointing at a folder). Child lists and sub-folders reference a parent folder via `body.parent_id` (entity id of a folder, or omitted/null at root). Nesting must not form cycles. **Folders cannot be archived** — only deleted. Deleting a folder recursively removes all sub-folders and moves every contained list to root (`parent_id: null`); list task items are kept. List **`body.closed: true`** means archived (lists only): hidden from the main sidebar by default (`tasklist.list` unless `include_closed`), restorable via `tasklist.patch({ closed: false })` only; **any other mutation on an archived list or its tasks** (rename, move, edit, complete, …) returns `清单已归档`. Deleting a non-folder list removes its task items when `cascade` is true (default). `sort_order` is scoped among siblings sharing the same `parent_id`.

LLM ToolSets: `@freeanima/feature-task/domain` — `task` (item CRUD + `task_search`) and `tasklist` (list CRUD + `tasklist_search`); load via `toolset_load`. `task_search` searches all lists when `list_id` is omitted. Legacy `tasks` table and `/api/tasks/*` are removed after one-time migration ([`scripts/archive/migrate-tasks-to-entities.ts`](../../scripts/archive/migrate-tasks-to-entities.ts)).

### Shell UI: global Subject scope

Hub startup binds **`ResolvedWorldContext`** (`hub().call("worlds.context")` / `GET /hub/rpc/v1/worlds/context`). The product shell exposes a **single User / Agent toggle** in the module header — not an arbitrary `world_id` picker. Selection maps to `user_world_id` / `agent_world_id` and persists in `sessionStorage` for the tab.

| Surface          | World binding                                                           | Control                        |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------ |
| Shell header     | `user_world_id` or `agent_world_id`                                     | global **User / Agent** toggle |
| `/tasks`         | follows shell scope via SAP `subject_kind`                              | none (inherits header)         |
| `/projects`      | follows shell scope via SAP `subject_kind`                              | none (inherits header)         |
| `/email`         | follows shell scope via SAP `subject_kind`                              | none (inherits header)         |
| `/notifications` | `recipient_kind` + subject entity id                                    | none (inherits header)         |
| `/diary`         | subject default private world via `subject_kind`                        | none (inherits header)         |
| `/dream`         | agent default private world (Shell fixed); LLM tool optional `world_id` | none (inherits header)         |
| `/vault`         | default **user** library; optional Agent view                           | User: master password lock     |

SAP task/email methods accept optional `subject_kind` (defaults: task `user`, email `agent`). Satellites read the shell scope via **`useSubjectScope()`** from `@freeanima/shell-sdk`; Hub REST entity search uses **`resolveWorldIdForSubject()`** with the same scope.

Future multi-world browse (e.g. diary calendar aggregation across worlds) should add **module-scoped** filters or Console tooling — not a speculative arbitrary world picker.

## Project module (v1 spec)

Project management uses a **separate folder tree** from task-list folders. Tasks belong to either the task module (Backlog, `project_id` null) or exactly one project — not both in UI at once.

| Concept        | Entity         | Component        |
| -------------- | -------------- | ---------------- |
| Project folder | `type=content` | `project_folder` |
| Project        | `type=content` | `project`        |
| Milestone      | `type=content` | `milestone`      |

`task_item.body.project_id` and optional `milestone_id` link items to projects. Smart Lists in the task module default to tasks with no `project_id`. Shell route `/projects`; Hub RPC `projectfolder.*`, `project.*`, `milestone.*`; extended `task.*` for ownership moves.

Full spec: [`docs/features/project.md`](../features/project.md).

## Email module (Estate)

Email accounts, threads, and mirrored messages map to:

| Concept | Entity         | Component       |
| ------- | -------------- | --------------- |
| Account | `type=content` | `email_account` |
| Thread  | `type=content` | `email_thread`  |
| Message | `type=content` | `email_message` |

Accounts store SMTP/IMAP settings and sync cursor in `body.sync`. Messages store IMAP UID in `body.imap_uid`; human-readable subject/body use entity columns. IMAP sync upserts threads/messages; UI lives in shell `/email` (SAP `email.*` methods), not Console REST.

LLM ToolSets: `@freeanima/feature-email/domain` — `email-account` (account entities) and `email` (sync, send/receive, search); load via `toolset_load`. User and agent each have accounts in their **default private world**; LLM tools accept optional **`world_id`** (SAP uses `subject_kind`). Legacy `config.yaml` `email.accounts[]` migrates via [`scripts/archive/migrate-email-to-entities.ts`](../../scripts/archive/migrate-email-to-entities.ts).

## Diary module

Structured journal entries for **user** and **agent** subjects:

| Concept | Entity         | Component     |
| ------- | -------------- | ------------- |
| Entry   | `type=content` | `diary_entry` |

Entries live in each subject's **`default_private_world_id`**. `body.entry_at` is the timeline sort key; `title` / `summary` / `content` use entity columns; optional `body.tags`.

- **SAP:** `diary.*` methods — all take `subject_kind: user | agent` (including `diary.append`).
- **UI:** shell `/diary` (`@freeanima/satellite-diary`).
- **LLM:** ToolSet `diary` — caller subject private world by default; optional `world_id`.

See [`docs/features/diary.md`](../features/diary.md).

## Dream module

Nightly creative narratives (append-only, one per CST calendar day):

| Concept | Entity         | Component     |
| ------- | -------------- | ------------- |
| Entry   | `type=content` | `dream_entry` |

Entries live in the **agent** subject's **`default_private_world_id`**. `body.dream_day` is the unique key per world; narrative text uses entity `content`; optional `body.source_limbic_ids`, `body.source_conversation_ids`, `body.episodic_snippets`.

- **Hub RPC:** `dream.list`, `dream.get` (bundled shell; no `subject_kind` — always agent world).
- **UI:** shell `/dream` (`@freeanima/satellite-dream`).
- **LLM:** ToolSet `dream` — `dream_read`; optional `world_id` (Shell UI stays agent-scoped).

See [`docs/concepts/dream.md`](dream.md).

## Vault module (Estate)

Encrypted credentials in two libraries (**User** + **Agent**), ECS components `vault_config` + `vault_item`:

| Concept | Entity         | Component      |
| ------- | -------------- | -------------- |
| Config  | `type=content` | `vault_config` |
| Item    | `type=content` | `vault_item`   |

| Library | Crypto mode       | Decrypt location          | Headless inject                     |
| ------- | ----------------- | ------------------------- | ----------------------------------- |
| User    | `master_password` | Client (Shell)            | No — Chat unlock box or `/vault` UI |
| Agent   | `machine`         | Hub (`agent-machine.key`) | Yes — cron / tools                  |

Privacy fields live in `body.secrets_enc` + `body.dek_wrapped`; metadata (title, url, username, custom field **names**) is plaintext for search.

- **SAP:** `vault.*` — Shell defaults `subject_kind: user`; ToolSet defaults agent world.
- **UI:** shell `/vault` (`@freeanima/satellite-vault`); bundled Chat has a dedicated master-password unlock (not a chat message).
- **LLM:** ToolSet `vault` — metadata + `vault_inject_env` ack only; never plaintext secrets in context.
- **Config:** `vault("item_id", "field")` resolves Agent library at Hub boot (legacy `credential()` removed).

Legacy pass (`~/.password-store`) is **not** deleted on disk; migrate entries manually via Shell UI.

## Search

Entity **list** (deterministic browse) and **search** (relevance ranking) are separate ports:

| Port                      | Role                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `EntityStorePort.list`    | Structural filters; stable sort                                       |
| `EntitySearchPort.search` | Hard filters + optional text query; hybrid FTS/trigram/vector via RRF |

**Scope:** default `world_id`; `global: true` requires an explicit accessible-world allowlist (`resolveWorldsAccessibleBySubject`: public + owned private + grant-readable worlds).

**Component filters:** whitelisted per `primary_component` (e.g. `task_item`: `status`, `list_id`, `tags`, `due_today`). Arbitrary JSONPath is forbidden.

**Tools / API:** `entity_search` (LLM/MCP) and `hub().call("entity.searchGet")` / `hub().call("entity.searchPost")` (REST `GET /hub/rpc/v1/entity/searchGet` | `POST /hub/rpc/v1/entity/searchPost`) share `EntitySearchPort`. Task UI search box uses the same Hub RPC endpoint.

See memory hybrid search in [`memory.md`](memory.md) for FTS operator syntax; entity search reuses the same query builder.

**FTS index:** same `fts_segmented` + jieba write path as semantic memory (`resolveFtsSegmentedForWrite` on entity create/update). Legacy rows imported before this column may lack segmentation; run Console **FTS** rebuild (`onlyMissing`) to backfill `entities.fts_segmented` so jieba query tokens align with the GIN index.

## Future migration map (not executed yet)

| Legacy table                 | Target                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `dream_memory`               | `dream_entry` (agent world; migration backfill + DROP)                                                                     |
| `semantic_memory`            | `content` + memory component                                                                                               |
| `autobiographical_memory`    | `content` + narrative component                                                                                            |
| `limbic_memory`              | `content` + limbic component                                                                                               |
| `tasks` (legacy)             | `task_item` (when explicitly migrated)                                                                                     |
| `config.yaml email.accounts` | `email_account` (see [`scripts/archive/migrate-email-to-entities.ts`](../../scripts/archive/migrate-email-to-entities.ts)) |
| `memory_references`          | relationship table (future)                                                                                                |

See [`architecture.md`](architecture.md) for cognitive-layer context.

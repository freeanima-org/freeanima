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

| Column                          | Role                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `id`                            | `bigint` identity — global numeric ID                       |
| `type`                          | One of four entity types                                    |
| `world_id`                      | Native owning World (FK → `entities.id`)                    |
| `components`                    | `text[]` component tags                                     |
| `primary_component`             | Main component for module routing                           |
| `title` / `summary` / `content` | Shared text columns (all components may use)                |
| `body`                          | JSONB component payload                                     |
| `pinned`                        | Entity-level pin（任意 component）                          |
| `reference_count`               | `[[anima:id]]` 引用权重和                                   |
| `tag_ids`                       | 关联 `primary_component=tag` 的 entity id 数组（per-World） |
| `created_at` / `updated_at`     | Timestamps                                                  |

**Not in v0.8 bootstrap:** relationship table, World nesting/mount, graph DB (PostgreSQL AGE). Subject↔world grants live in `world_config.grants` (no separate permission table).

## Subject (`agent` / `user`)

- Identity is **`type`** plus `agent_config` or `user_config` primary component.
- Subjects are **not** scoped by `world_id` in a membership sense; row `world_id` stays at bootstrap root (`ENTITY_ROOT_WORLD_ID`) as a table placeholder.
- **`agent_config` / `user_config` body**: `default_private_world_id` — the subject's single default private world (auto-created on subject create; configurable from private worlds owned by the subject).
- **Notifications** use subject entity ids as `recipient_id` (see [`notifications.md`](notifications.md)); ids come from boot-time **`ResolvedWorldContext`** (and are persisted to `hub_runtime_config.worlds`).
- **Service API Token**（`service_api_tokens` 表）绑定 subject entity id；Hub REST/SAP/MCP 从 Bearer token 解析调用方身份。见 [`remote-access.md`](../guide/remote-access.md)。

### Boot-time ensure (`worlds` config)

Hub startup runs **`ensureWorldSubjects()`** once (after migrations, before engine):

- **Optional override**: if `hub_runtime_config.worlds.user_subject_id` / `agent_subject_id` (or legacy `notifications`) are set, ensures those entity ids exist with the correct `type`.
- **Unconfigured**: discovers the lowest-id entity of `type=user` / `type=agent`; if none exist, creates them with the next serial id (not fixed `1`/`2`).
- Ensures each subject has a **default private world** (`default_private_world_id`); private world ids are **not fixed**.
- If resolved ids differ from config (including when unset), **persists** them back to `hub_runtime_config.worlds` so the next boot is stable.
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

### UI location: Anima URI

Shell UI locates entities with **Anima URI** (`anima:{id}?component=…`), not by storing URI strings in PG. FK fields remain numeric ids (e.g. `task_item_id`). Omitting `component` defaults to this entity’s `primary_component` when opening. See [`anima-uri.md`](anima-uri.md) — especially **Layering vs persistence**.

## Task module (first consumer)

TickTick-style lists and items map to:

| Concept     | Entity         | Component      |
| ----------- | -------------- | -------------- |
| Task domain | `type=world`   | `world_config` |
| List        | `type=content` | `task_list`    |
| Item (task) | `type=content` | `task_item`    |

Items reference their list via `body.list_id` (entity id). Task items store **title** and **content** on entity columns; **tags** 使用顶层 `tag_ids`（指向同 World 的 `tag` entity，见下节）。各模块遗留的 `body.tags` 字符串数组不再作为任务试点读写路径。Each world gets a **default list** (`is_default: true`, name e.g.「收件箱」) **lazily** on first task use (`ensureDefaultTaskListForWorld`); it cannot be deleted or archived but may be renamed. List **`body.closed: true`** means archived: hidden from the main sidebar by default (`tasklist.list` unless `include_closed`), restorable via `tasklist.patch({ closed: false })`; contained task items are kept.

Task/list **LLM 工具**默认在 **agent subject 专属 private world** 操作，多数调用可省略 `world_id`；按 `id` / `list_id` 操作时从实体反查 world 并校验 caller 权限。**MCP** 工具默认 scope 为 token 绑定 subject 的 private world。Shell SAP/REST 仍通过 `subject_kind` 选择 user/agent world（见下表）。

**Folders** (`body.is_folder: true`) are container nodes in the sidebar tree only — they cannot hold tasks directly (`tasklist.item.create` / `task.moveToList` reject `list_id` pointing at a folder). Child lists and sub-folders reference a parent folder via `body.parent_id` (entity id of a folder, or omitted/null at root). Nesting must not form cycles. **Folders cannot be archived** — only deleted. Deleting a folder recursively removes all sub-folders and moves every contained list to root (`parent_id: null`); list task items are kept. List **`body.closed: true`** means archived (lists only): hidden from the main sidebar by default (`tasklist.list` unless `include_closed`), restorable via `tasklist.patch({ closed: false })` only; **any other mutation on an archived list or its tasks** (rename, move, edit, complete, …) returns `清单已归档`. Deleting a non-folder list removes its task items when `cascade` is true (default). `sort_order` is scoped among siblings sharing the same `parent_id`.

LLM ToolSets: `@freeanima/feature-task/domain` — `task` (item CRUD + `task_search`) and `tasklist` (list CRUD + `tasklist_search`); load via `toolset_load`. `task_search` searches all lists when `list_id` is omitted. Legacy `tasks` table and `/api/tasks/*` are removed after one-time migration ([`scripts/archive/migrate-tasks-to-entities.ts`](../../scripts/archive/migrate-tasks-to-entities.ts)).

### Shell UI: global Subject scope

Hub startup binds **`ResolvedWorldContext`** (`hub().call("worlds.context")` / `GET /hub/rpc/v1/worlds/context`). The product shell exposes a **single User / Agent toggle** in the module header — not an arbitrary `world_id` picker. Selection maps to `user_world_id` / `agent_world_id` and persists in `sessionStorage` for the tab.

| Surface          | World binding                                    | Control                        |
| ---------------- | ------------------------------------------------ | ------------------------------ |
| Shell header     | `user_world_id` or `agent_world_id`              | global **User / Agent** toggle |
| `/tasks`         | follows shell scope via SAP `subject_kind`       | none (inherits header)         |
| `/projects`      | follows shell scope via SAP `subject_kind`       | none (inherits header)         |
| `/email`         | follows shell scope via SAP `subject_kind`       | none (inherits header)         |
| `/notifications` | `recipient_kind` + subject entity id             | none (inherits header)         |
| `/diary`         | subject default private world via `subject_kind` | none (inherits header)         |
| `/vault`         | default **user** library; optional Agent view    | User: master password lock     |

SAP task/email methods accept optional `subject_kind` (defaults: task `user`, email `agent`). Satellites read the shell scope via **`useSubjectScope()`** from `@freeanima/shell-sdk`; Hub REST entity search uses **`resolveWorldIdForSubject()`** with the same scope.

Future multi-world browse (e.g. diary calendar aggregation across worlds) should add **module-scoped** filters or Console tooling — not a speculative arbitrary world picker.

## Tag module（轻语义）

标签是独立 content entity，**per-World 扁平池**（无 scope/命名空间、无层级、无全局池）：

| Concept | Entity         | Component |
| ------- | -------------- | --------- |
| Tag     | `type=content` | `tag`     |

- **名称**在 entity `title`；body 仅 `sort_order` / `client_op_id`
- 任意 content entity 通过顶层 **`tag_ids`** 挂载标签；含义由「实体类型 + 标签」组合自然产生（不做语义空间区分）
- 同 World 内 title（trim 后）唯一；删除标签时从该 World 所有实体的 `tag_ids` 剔除
- **Hub RPC：** `tag.list` / `tag.search` / `tag.create` / `tag.patch` / `tag.delete` / `tag.setOnEntity`
- **LLM ToolSet：** `tag`（`tag_list` / `tag_search` / `tag_create` / `tag_update` / `tag_delete` / `tag_set_on_entity`）
- **搜索：** `EntitySearchOpts.tag_ids`（或 `task_item` filters.`tag_ids`）为数组包含过滤（AND）
- **UI 试点：** 任务详情 TagPicker + 列表按标签筛选；其他模块后续接入

## Project module (v1 spec)

Project management uses a **separate folder tree** from task-list folders. Tasks belong to either the task module (Backlog, `project_id` null) or exactly one project — not both in UI at once.

| Concept        | Entity         | Component        |
| -------------- | -------------- | ---------------- |
| Project folder | `type=content` | `project_folder` |
| Project        | `type=content` | `project`        |

`task_item.body.project_id` links items to a project. Optional project background notes use entity `content` (not `body`). Smart Lists in the task module default to tasks with no `project_id`. Shell route `/projects`; Hub RPC `projectfolder.*`, `project.*`, `project.item.*`；跨边界归属用 `task.moveToProject` / `task.moveToList`。

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

Entries live in each subject's **`default_private_world_id`**. `body.entry_at` is the timeline sort key; optional `body.tags`. **Body text lives in child `content_block` rows** (`block_type: text`, `parent_id` → entry); the container entity `content` column is unused (empty after one-shot migration).

- **SAP:** `diary.*` + `diary.block*` — all take `subject_kind: user | agent`. `diary.append` adds a new text block; `diary.patch` updates metadata only; delete cascades blocks.
- **UI:** shell `/diary` — multi text-block editor with drag reorder.
- **LLM:** ToolSet `diary` — caller subject private world by default; optional `world_id`. Block-level edits also via ToolSet `content-block`.

See [`docs/features/diary.md`](../features/diary.md).

## Content block

Reusable content bricks for **containers** (diary, notes, …). `block_type` is technical only; semantics attach via `components[]` tags (not a nested JSONB `components` column — tags stay `text[]`, fields merge flat into `body`).

| Concept | Entity         | Component       |
| ------- | -------------- | --------------- |
| Block   | `type=content` | `content_block` |

| Body / column     | Role                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `body.block_type` | `text` \| `image` \| `audio` \| `video` \| `link_card` \| `file` |
| `body.parent_id`  | Container entity id (`diary_entry`; later: note)                 |
| `body.sort_order` | View order; blocks have no semantic precedence                   |
| `body.url`        | Resource locator for non-text types; null for text               |
| `content` column  | Text body or media caption                                       |

Optional semantic components on the same row (`components[]`; fields merge into flat `body`):

| Component         | `body` fields                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `limbic`          | `valence`, `arousal`, `intensity`, optional provenance (`kind`, `legacy_id`, …)                     |
| `narrative`       | `significance`, optional `period_*` / `status` / `legacy_id`                                        |
| `dream`           | `source_limbic_ids`, `source_conversation_ids`, `episodic_snippets`, `legacy_id`                    |
| `semantic_ref`    | `entity_id`（指向 `primary_component=semantic_memory` 的 entity）                                   |
| `semantic_memory` | `memory_kind`, `status`, `source_conversations`, `observed_at`, `occurred_at`, optional `legacy_id` |

**Container end-state:** `diary_entry` is the only content-block container. Dream / limbic / autobiographical memories are `content_block` rows with the matching semantic tag under the dated diary for that CST day (agent default private world for sleep writes).

- **LLM:** ToolSet `content-block` (`@freeanima/features/content-block/domain`) — `content_block_create` / `update` / `delete` / `get` / `list` / `search` / `reorder`. `list` requires container `parent_id`; optional `component=limbic|narrative|semantic_ref|dream` filters semantic tags; `reorder` batch-updates `sort_order`. Optional `world_id`; `parent_id` / block `id` infer world.
- **Search filters:** `parent_id`, `block_type`, `client_op_id` (whitelist shared by `entity_search` / store).

## Dream (sleep pipeline)

Nightly creative narratives (append-only, at most one dream block per diary day):

| Concept | Entity         | Components                |
| ------- | -------------- | ------------------------- |
| Dream   | `type=content` | `content_block` + `dream` |

Writes go to the **agent** subject's **`default_private_world_id`**: ensure that day's `diary_entry`, then insert a text `content_block` tagged `dream`. Calendar day comes from the parent diary `entry_at` (CST), not a `dream_day` body field.

- **Read:** `diary_get` / `content_block_list` / `content_block_search` with `component=dream`.
- **UI:** Shell `/diary` shows dream blocks with a read-only「梦境」label (no independent `/dream` module).
- **LLM:** No dedicated `dream` ToolSet; sleep `runDream` still generates blocks.

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
- **LLM:** ToolSet `vault` — metadata list/search/get (MCP); `vault_create` / `vault_update` / `vault_delete` Habitat-only (Agent library seal for create/update); credentials via `terminal_run` / `code_execute` `secrets[]` (child env only) or `browser_type` `secret` (typed into page; redacted in tool results); never plaintext secrets in tool results or Hub `process.env`.
- **Config:** `vault("item_id", "field")` resolves Agent library at Hub boot (legacy `credential()` removed).

Legacy pass (`~/.password-store`) is **not** deleted on disk; migrate entries manually via Shell UI.

## Search

Entity **list** (deterministic browse) and **search** (relevance ranking) are separate ports:

| Port                      | Role                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `EntityStorePort.list`    | Structural filters; stable sort                                |
| `EntitySearchPort.search` | Hard filters + optional text query; hybrid FTS/trigram via RRF |

**Scope:** default `world_id`; `global: true` requires an explicit accessible-world allowlist (`resolveWorldsAccessibleBySubject`: public + owned private + grant-readable worlds).

**Component filters:** whitelisted per `primary_component` (e.g. `task_item`: `status`, `list_id`, `tag_ids`, `due_today`). Top-level `tag_ids` filter applies across components. Arbitrary JSONPath is forbidden.

**Tools / API:** `entity_search` (LLM/MCP) and `hub().call("entity.searchGet")` / `hub().call("entity.searchPost")` (REST `GET /hub/rpc/v1/entity/searchGet` | `POST /hub/rpc/v1/entity/searchPost`) share `EntitySearchPort`. Task UI search box uses the same Hub RPC endpoint.

See memory hybrid search in [`memory.md`](memory.md) for FTS operator syntax; entity search reuses the same query builder.

**FTS index:** same `fts_segmented` + jieba write path as semantic memory (`resolveFtsSegmentedForWrite` on entity create/update). Legacy rows imported before this column may lack segmentation; run Console **FTS** rebuild (`onlyMissing`) to backfill `entities.fts_segmented` so jieba query tokens align with the GIN index.

## Future migration map

| Legacy table                   | Target                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `dream_memory` / `dream_entry` | `content_block` + `dream`（parent = dated `diary_entry`；**done**；独立 `/dream` UI / ToolSet 已退役）                     |
| `semantic_memory`              | `primary_component=semantic_memory`（独立 entity；**done**）                                                               |
| `autobiographical_memory`      | `content_block` + `narrative`（parent = dated `diary_entry`；**done**）                                                    |
| `limbic_memory`                | `content_block` + `limbic`（parent = dated `diary_entry`；**done**）                                                       |
| `diary_entry` single body      | Container + child `content_block`s (**done**; migration clears container `content`)                                        |
| Global temporal digests        | `primary_component=temporal_summary`（day/month/year；见 [`temporal-summary.md`](temporal-summary.md)）                    |
| `tasks` (legacy)               | `task_item` (when explicitly migrated)                                                                                     |
| `config.yaml email.accounts`   | `email_account` (see [`scripts/archive/migrate-email-to-entities.ts`](../../scripts/archive/migrate-email-to-entities.ts)) |
| `memory_references`            | relationship table (future)                                                                                                |

See [`architecture.md`](architecture.md) for cognitive-layer context.

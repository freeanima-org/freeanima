---
title: Diary
---

# Diary

Structured diary for users and Agents, based on the [Unified Entity Model](../product/entity-model.md) `diary_entry` **container** plus child `content_block` (text) bricks.

## vs memory system

| Capability | Diary                                              | Memory bricks (limbic / narrative / dream)                               |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Source     | User / Agent **writes actively**                   | Sleep pipeline / memory tools                                            |
| Storage    | `entities` + `diary_entry` + child `content_block` | Same diary containers + semantic tags (`limbic` / `narrative` / `dream`) |
| Editing    | Plain text blocks updateable                       | Semantic bricks append-only / soft-deprecate                             |
| Namespace  | subject **default private world**                  | Agent private world for sleep-written bricks                             |

Diary UI labels semantic bricks（梦境 / 情绪 / 自传）as read-only sections in the day entry.

## User / Agent isolation

- User and Agent diaries live in the **default private world** of subjects resolved from boot-time `ResolvedWorldContext` / `habitat_runtime_config.worlds` (`user_subject_id` / `agent_subject_id`).
- Shell header **User / Agent** toggle selects which subject's diary to view (see [`entity-model.md`](../product/entity-model.md) global Subject scope).
- LLM tools (ToolSet `diary`) default to the **caller subject's private world** (conversation LLM → agent world); optional **`world_id`** overrides (e.g. `user_world_id` from system prompt).

## Data shape

**Container** (`diary_entry`):

- `body.entry_at` — ISO 8601, when the diary entry occurred (**unique per day** per subject private world)
- `tag_ids` — optional tags（顶层 `entities.tag_ids`，指向同 World 的 `tag` entity）
- `title` / `summary` — entity columns
- container **`content` is not used for body text** (kept empty after migration)

**Blocks** (`content_block`, `block_type: text`):

- `body.parent_id` → diary entry id
- `body.sort_order` — view order (no semantic precedence)
- text lives in the block's `content` column
- optional `title` (entity column) — user-editable block heading; empty means no heading weight in UI
- optional `tag_ids` (entity column) — unified entity tags（与日记容器同一模型）
- semantic component tags on the block (`dream` / `limbic` / `narrative`) render as read-only labels（梦境 / 情绪 / 自传）beside the title; they are **not** the block title

**日记块模板** (`diary_block_template` entity, subject private world):

- `entities.title` = **模板名称**（列表/管理显示）
- `entities.content` / `entities.tag_ids` stay empty — do **not** store insert payload there
- `body.preset` = `{ title, content, components, tag_ids }` applied when inserting a new text block
- SAP: `diary.templateList` / `templateCreate` / `templatePatch` / `templateDelete`
- Empty world lazy-seeds「今日回顾」「运动」

UI also persists per-block expand/collapse in localStorage (default expanded).

One-shot migration: Habitat `runMigrations` moves legacy diary `content` into the first text block and clears the container column.

## Agent tools (ToolSet `diary`)

Load via `toolset_load` with `diary`. Tools locate entries by **`date` (YYYY-MM-DD)**；**default today** (CST noon `…T12:00:00+08:00`)；**no `diary_create`** — use `diary_append` (creates empty shell for the day if missing, then adds a **new text block**). All tools accept optional **`world_id`**.

| Tool           | Description                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `diary_append` | New text block for date; create shell if missing; storage `tag_ids`（工具可选 `tags` 标题）only on shell creation |
| `diary_update` | Update entry **metadata** (title/summary/`tag_ids`；工具可选 `tags` 标题) by date — not body text                 |
| `diary_get`    | Read entry + `blocks` for date; error if not found                                                                |
| `diary_delete` | Delete entry for date (cascades child blocks); returns `{ ok, action, date }`                                     |
| `diary_list`   | List by `entry_at DESC` (default `limit=20`, `offset`); optional date / `tag_ids`（工具可选 `tags` 标题过滤）     |
| `diary_search` | Hybrid search over **text blocks**, returns matching diary entries                                                |

Fine-grained block CRUD / reorder: ToolSet `content-block`.

**vs SAP/UI**: Shell `/diary` uses SAP `diary.*` / `diary.block*` located by entity **`id`**; Agent ToolSet uses **`date`** uniformly.

## SAP methods

UI satellite `@freeanima/satellite-diary` (`/diary`) calls SAP:

- `diary.list` / `diary.create` / `diary.append` / `diary.patch` / `diary.delete` / `diary.get` / `diary.search`
- `diary.blockCreate` / `diary.blockPatch` / `diary.blockDelete` / `diary.blockReorder` (text only; create/patch accept optional `title` / `tag_ids` / `components`)
- `diary.templateList` / `diary.templateCreate` / `diary.templatePatch` / `diary.templateDelete`（日记块模板；`name` ≠ `preset`）

All methods require `subject_kind: user | agent`.

- `diary.list` defaults to **`entry_at DESC`**, `limit=20`, supports `offset` pagination
- `diary.create` optional `content` → first text block (container `content` stays empty)
- `diary.append` → new trailing text block
- `diary.patch` → container metadata only
- `diary.delete` → cascade-delete child blocks
- `diary.template*` → CRUD for `diary_block_template`（模板名 `name` + 插入载荷 `preset`）

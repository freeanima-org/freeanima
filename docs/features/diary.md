---
title: Diary
---

# Diary

Structured diary for users and Agents, based on the [Unified Entity Model](../concepts/entity-model.md) `diary_entry` component.

## vs memory system

| Capability | Diary                             | Autobiographical memory                    |
| ---------- | --------------------------------- | ------------------------------------------ |
| Source     | User / Agent **writes actively**  | **Extracted** from dialogue in light sleep |
| Storage    | `entities` + `diary_entry`        | `autobiographical_memory` table            |
| Editing    | Update and delete allowed         | append-only                                |
| Namespace  | subject **default private world** | Digital-life memory pipeline               |

## User / Agent isolation

- User and Agent diaries live in the **default private world** of subjects from `config.yaml` `notifications.user_subject_id` / `agent_subject_id`.
- Shell `/diary` top bar switches **User / Agent** view.
- Agent LLM tools (ToolSet `diary`) always write to **Agent** private world.

## Agent tools (ToolSet `diary`)

Load via `toolset_load` with `diary`. Agent tools locate entries by **`date` (YYYY-MM-DD)**; **default today** (CST noon `…T12:00:00+08:00`); **no `diary_create`** — use `diary_append` (creates empty shell for the day if missing, then appends).

| Tool           | Description                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `diary_append` | Append body for date (`\n\n` separator); create shell if missing; `tags` only on shell creation |
| `diary_update` | Replace full entry or fields by date (not append)                                               |
| `diary_get`    | Read entry for date; error if not found                                                         |
| `diary_delete` | Delete entry for date; returns `{ ok, action, date }`                                           |
| `diary_list`   | List / date filter (unchanged)                                                                  |
| `diary_search` | Hybrid search (unchanged)                                                                       |

**vs SAP/UI**: Shell `/diary` and human editing use SAP `diary.create` / `diary.patch` etc., located by entity **`id`**; Agent ToolSet is LLM-only and uses **`date`** uniformly.

## SAP methods

UI satellite `@freeanima/satellite-diary` (`/diary`) calls SAP:

- `diary.list` / `diary.create` / `diary.append` / `diary.patch` / `diary.delete` / `diary.get` / `diary.search`

All methods require `subject_kind: user | agent`.

## Data shape

`diary_entry` body:

- `entry_at` — ISO 8601, when the diary entry occurred (**unique per day** per subject private world)
- `tags` — optional tags

Title, summary, body use entity columns `title` / `summary` / `content`.

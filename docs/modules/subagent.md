---
title: Subagent
---

# Subagent (in-process)

Named subagent profiles are stored as `entities` (`primary_component = subagent`). Parent conversations manage profiles and dispatch work through ToolSet **`subagent`**.

## Execution path

- `subagent_run` → `runAutoLlm({ runKind: "subagent" })`
- Fresh message context; the **final** result is only the tool return value (not written to parent `messages`, not light-sleep input). The parent turn still waits for the tool to finish before the next LLM hop.
- While running, compact `steps[]` (`name` / `title` / `status`) are projected to the parent Chat tool strip via engine `tool_progress` → `tool_round_live` (same `tool_call_id`; status stays `running`). Child turns are still not written into parent `messages`.
- Return payload may include the same compact `steps[]` for parent Chat multi-level expand
- `depth=1`: child runs HARD_DENY all `subagent_*` tools

## Named vs ephemeral

|              | **Named**                                        | **Ephemeral**                                               |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| Identity     | `slug` or `id` (entity)                          | omit both                                                   |
| Role prompt  | entity `content` (preconfigured)                 | call `instructions` (parent LLM fills each time)            |
| Tool ceiling | entity `allowed_tools` (cannot enlarge via call) | call **`allowed_tools` required** (array; empty = no tools) |
| `title`      | optional override for AutoLlm `run_name`         | strongly recommended; fallback title / `ephemeral`          |
| Skills       | entity + call union                              | call `skills` only                                          |

## Tool policy (strict materialize)

1. Profile `allowed_tools` is the **only ceiling** (empty = no tools; may include `@ToolSet`)
2. Profile / skill / caller `denied_tools` merge into deny; **deny wins**
3. HARD_DENY: `toolset_load`, `toolset_search`, and all `subagent_*`
4. The resolved set is **materialized to concrete tool names** as LLM `tools` plus frozen `executableTools`
5. Skills: `prependSkillsToPrompt` injects bodies; skill deny may narrow; **skill allow cannot enlarge** the ceiling

## Dispatch

- Single task sugar or `tasks[]` (parallel, `auto_llm.subagent.max_parallel`, default 4)
- `max_turns`: call > profile > `auto_llm.subagent.max_turns` (default 20)

## Child system prompt path (not conversation)

Default **minimal** (no self / resident / env-health / catalogs / channel):

1. `systemPromptBuild` with `llm_kind: auto_llm` (only handlers registered for `auto_llm` \| `all`)
2. Opt-in side sections via `prompt_includes`: `self` \| `world` \| `time` — **union** of entity body + call args; default none
3. Role section: named `content` or ephemeral `instructions`

Conversation prompt sections register with `llm_kind: conversation` and stay out of child runs.

## Builtin profiles

On Habitat boot, the agent private world is **ensured** (idempotent by slug; existing rows are not overwritten):

| slug       | Role                                                               |
| ---------- | ------------------------------------------------------------------ |
| `general`  | General-purpose local tools                                        |
| `explorer` | Read-only explore (memory / file / docs / web)                     |
| `research` | 调研 — structured research (`research` skill + web/browser/memory) |

## Parent catalog

Visible chats inject a short multi-step guidance (Subagent → skills → toolsets) then a **Subagents** section (`slug` + summary) **before** Skills (`llm_kind: conversation`). Dispatch with `subagent_run`.

## Habitat UI

`/subagents`: list / create / edit allow-deny, skills, `prompt_includes`. Audit: AutoLlmRuns (`run_kind=subagent`); `run_name` from call `title`.

## vs ACP

ACP has been removed. Task-level delegation is this module; external protocol tools stay on MCP.

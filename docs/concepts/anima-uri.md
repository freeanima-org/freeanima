---
title: Anima URI
---

# Anima URI

Stable, parseable entity locators for Shell UI (deep links, overlay, clipboard) and **future** Markdown / rich-text click handling.

**Scheme:** `anima:` (no `//`). Example:

```text
anima:42?component=task_item&present=overlay
```

## Motivation

- Recognize and open entities from **text** (Markdown, notices) later via `openEntityResource`
- Share / deep-link / cross-module open today
- Structured FK in PG/Habitat remain **numeric ids** — Anima URI is not a persistence format

This task ships: grammar + `parse`/`format` + overlay registry + `task_item` sample. **Not yet:** Chat Markdown link interception.

## Grammar

```text
anima:{id}[?component={component}][&present=navigate|overlay]
```

| Part        | Meaning                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `entities.id` (positive integer)                                                                                                              |
| `component` | Component tag used as the **view facet** (which overlay / module mapping). Optional; if omitted, open resolves **`primary_component`**        |
| `present`   | `navigate` = switch Shell module and select; `overlay` = open registered overlay. Defaults depend on component (e.g. `task_item` → `overlay`) |

**No short aliases** (e.g. `task` is invalid). Values must be full component names.

**Do not use** `anima://…` as the normative form (id would be mis-parsed as URL host; `anima://42:task_item` is an invalid URL).

Same `id` with different `component=` can open **different** overlays (entity may carry multiple `components[]`). Registry key is the component tag, not the Shell module id.

## Layering vs persistence

| Layer                   | Stores                                         | Anima URI                                                 |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| PG / Habitat body / RPC | Entity **`id`** (e.g. pomodoro `task_item_id`) | **Never** as FK string                                    |
| Shell UI                | —                                              | `formatAnimaUri` / `parseAnimaUri` / `openEntityResource` |

Anima URI is a **Shell/UI locator protocol**, not a database foreign key. User-authored body text that happens to contain `anima:…` is content, not a structured relation.

## Overlay registration

Each displayable component may `registerEntityOverlay(component, OverlayComponent)`.  
`present=overlay` → resolve component (default `primary_component`) → look up registry → `EntityOverlayHost`.  
`present=navigate` → map component → Shell path (e.g. `task_item` → `/tasks?item=…`) via `navigateShellModulePath`.

## Out of scope (for now)

- OS protocol / intent handlers for `anima:`
- Non-entity resources (conversation, …)
- Storing Anima URI strings in FK fields
- Full Markdown click interception in Chat

See also [`entity-model.md`](entity-model.md).

## Memory citations

Assistant/user message bodies cite entities with `[[anima:{id}]]` or `[[anima:{id}?component=semantic_memory]]`. Chat Markdown turns these into clickable anchors that call `openEntityResource` (default overlay for `semantic_memory`).

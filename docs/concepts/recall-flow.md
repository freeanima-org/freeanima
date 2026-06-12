---
title: Recall Flow
---

# Unified Recall Retrieval and Loading Flow

> **v1 ✅ Implemented:** `memory_recall(query)` four-source unified recall + RRF reranking, returns `results[]` (distinguished by `memory_type`); session hits are snippets ([`capabilities/memory/src/recall-search.ts`](../../capabilities/memory/src/recall-search.ts)).
> **v2 target design** (not implemented): resource layer + preset + lean index loading chain, see [Issue #47](https://github.com/freeanima-org/freeanima/issues/47).

## v1 Implemented

| Capability        | Description                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `memory_recall`   | Four sources: semantic / session / limbic / autobiographical; Top N; session returns snippet |
| `sessions_search` | Session message FTS; returns snippet (not full content)                                      |
| `memory_remember` | semantic_memory CRUD                                                                         |
| Resident memory   | system prompt injection (not recall)                                                         |

## v2 Target Design (Issue #47)

> The following is v2 design draft, **not current runtime behavior**.

- **`recall` retrieves only, does not load.** Returns lean index (title + description + type + id), not full content.
- **Scope: memory layer + resource layer.** Self layer always injected in system prompt, outside recall scope.
- **Loading handled by downstream tools.** recall tells the LLM "what exists"; LLM decides "what to fetch", then calls corresponding load tools.

## Retrieval Scope (v2 Design)

```
recall unified retrieval
├── Memory Layer
│   ├── Semantic memory — semantic_memory (world/experience/opinion/…)
│   ├── Episodic memory — messages (conversation FTS)
│   ├── Procedural memory — skills / procedural facts
│   └── Limbic memory — imprint (semantic_memory); limbic table (✅ implemented, light sleep Phase 2 writes, not via recall)
│
└── Resource Layer (Estate Layer, v2 design)
    ├── Tools
    ├── Skills
    ├── Internal assets (notes, projects, code, docs)
    └── Entity graph
```

### Out of Retrieval Scope

| Content                     | Reason                  | Access                                                   |
| --------------------------- | ----------------------- | -------------------------------------------------------- |
| Self layer six blocks       | Small, always needed    | Always injected in system prompt                         |
| Full tool schemas           | Needed only before call | `load_tools` (v2) / existing `reload_tools`              |
| Full memory detail          | Needed on demand        | `read_memory` (v2) / existing `remember` single-row read |
| Full file content           | Needed on demand        | `read_file` ✅                                           |
| Entity relationship network | Traverse on demand      | `graph_query` (v2)                                       |

## Presets (v2 Design)

`recall` uses `preset` parameter to steer search direction. Presets are **weighting templates** over memory/resource types.

### Preset Definitions

| Preset               | Semantic | Episodic | Limbic | Procedural | Skills | Tools | Notes                              |
| -------------------- | -------- | -------- | ------ | ---------- | ------ | ----- | ---------------------------------- |
| `balanced` (default) | Med      | Med      | Low    | Med        | Med    | Low   | General, no bias                   |
| `recall`             | High     | High     | High   | Low        | Low    | —     | Remember past, recover emotion     |
| `work`               | Low      | —        | —      | High       | High   | High  | Complete tasks, solve problems     |
| `debug`              | Med      | Med      | —      | High       | High   | High  | Troubleshoot, needs tech + context |
| `learn`              | High     | Low      | —      | High       | Med    | Low   | Understand a concept or domain     |

### Extensibility

Presets are templates, not fixed taxonomy. New presets later (e.g. `social`, `create`). Default `balanced` when preset omitted.

### Usage Examples

```
recall("how to query database", preset="work")
→ procedural memory +++
→ skills      +++
→ tools       +++
→ semantic    +
→ episodic    - (almost none)
→ limbic      -- (hardly needed)

recall("that database issue we discussed last time", preset="recall")
→ episodic    +++
→ limbic      +++
→ semantic    ++
→ procedural  +
→ skills      -
→ tools       -- (hardly needed)
```

## Full Flow (v2 Design)

```
Partner question / LLM needs information
        │
        ▼
① recall(query, preset="...")
   └── Unified search memory layer + resource layer
   └── Return lean result list (title + description + type + id)
        │
        ▼  LLM decides what is needed and how to use it
        │
② Choose downstream load tool by result type:

   ┌──────────────┬──────────────────────────┐
   │ Result type  │ Downstream load tool     │
   ├──────────────┼──────────────────────────┤
   │ Tool         │ load_tools(["name"])     │ → full schema
   │ Skill        │ load_skill("name")       │ → injectable skill
   │ Semantic/limbic memory │ read_memory("semantic_memory_id") │ → full fact content
   │ Episodic snippet │ scroll_session("id") │ → recent conversation context
   │ File/doc     │ read_file("path")        │ → file content
   │ Entity graph │ graph_query("entity")    │ → related network
   └──────────────┴──────────────────────────┘
        │
        ▼
③ LLM responds or decides further based on loaded content
```

### Example

```
You: Check on the server whether Nginx logs have recent errors

① I → recall("nginx logs server errors", preset="work")
    Returns:
    - Tool: tail_logs - view tail of file
    - Tool: grep_logs - search logs for keyword
    - Fact: Nginx logs at /var/log/nginx/access.log
    - Skill: Standard Nginx error troubleshooting flow

② I need tools → load_tools(["tail_logs", "grep_logs"])
    Returns full schema:
    tail_logs(path, lines)
    grep_logs(path, pattern)

③ I call tail_logs(path="/var/log/nginx/access.log", lines=50)
    grep_logs(path="/var/log/nginx/error.log", pattern="5xx")
```

## Relationship to Self Layer

Self layer (six blocks) is not retrieved via `recall`.

| Layer          | Injection                  | Reason                                                |
| -------------- | -------------------------- | ----------------------------------------------------- |
| Self layer     | Always in system prompt    | Small, fixed, every conversation needs "who I am"     |
| Memory layer   | `recall` + downstream load | Large, dynamic, search on demand                      |
| Resource layer | `recall` + downstream load | Tool definitions needed temporarily, load before call |

## Naming Rationale

The name `recall` stays unchanged.

In cognitive psychology, Recall is the standard term for actively pulling stored information from memory—no external cue, no prompt, you "remember" yourself. This is not exploring the unknown (discover/find), but retrieving what you already stored. Even when scope extends from memory layer to resource layer, the action's essence is unchanged.

## Design Evolution

```
v1 (✅ current): recall searches semantic_memory + messages FTS, returns JSON structured results
v2 (design #47): recall unified search memory layer + resource layer
            └── introduce preset
            └── introduce downstream load chain (load_tools / read_memory etc.)
v3 (future): TBD
```

## Open Questions

1. How many presets are enough? Do 3–5 cover most scenarios, or need more?
2. Format of recall "lean results"—structured JSON (LLM programmatic) or natural language (LLM direct understanding)?
3. Downstream load tool permission control—should `load_tools` be constrained by scene awareness / capability mask?

---
title: Recall Flow
---

# Unified Recall Retrieval

> **v1 ✅ Implemented:** `memory_recall(query)` four-source unified recall, returns `results[]` (distinguished by `memory_type`).

## v1 Implemented

| Capability        | Description                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `memory_recall`   | Four sources: semantic / conversation / limbic / autobiographical; Top N; conversation returns snippet |
| `sessions_search` | Session message search; returns snippet (not full content)                                             |
| `memory_remember` | Semantic memory CRUD during conversation                                                               |
| Resident memory   | System prompt injection (not recall)                                                                   |

### Four Sources

| `memory_type`      | Content type                          |
| ------------------ | ------------------------------------- |
| `semantic`         | Facts, preferences, experiences, etc. |
| `session`          | Historical conversation snippets      |
| `limbic`           | Emotional memory                      |
| `autobiographical` | Narrative title + content snippet     |

### Resident Memory

Separate from recall: **pinned** semantic memories plus **most-referenced** entries are always injected into the system prompt. LLM cites memory ID markers in replies; reference counts sync via nightly cron.

## Relationship to Self Layer

Self layer (six blocks) is **not** retrieved via `memory_recall`—it is always in the system prompt.

| Layer        | Injection                 | Reason                                            |
| ------------ | ------------------------- | ------------------------------------------------- |
| Self layer   | Always in system prompt   | Small, fixed, every conversation needs "who I am" |
| Memory layer | `memory_recall` on demand | Large, dynamic, search when needed                |

## Future Direction

Unified recall extending to resource layer (tools, skills, assets) with preset weighting is tracked in [Issue #47](https://github.com/freeanima-org/freeanima/issues/47). Not current runtime behavior.

## Naming Rationale

In cognitive psychology, **Recall** is actively pulling stored information from memory—retrieving what you already stored. Even when scope extends to resources, the action's essence is unchanged.

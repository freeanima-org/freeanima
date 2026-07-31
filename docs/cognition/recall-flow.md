---
title: Recall Flow
---

# Scoped Memory Retrieval

> **Current:** Active retrieval is **scope-split**. There is no cross-type unified `memory_recall` tool and no cross-type RRF merge for the LLM.

## Active tools by scope

| Scope            | Tool                                          | Notes                                                                   |
| ---------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| semantic         | `memory_semantic_search`                      | FTS + structured filters; also **passive** inject before each user turn |
| limbic           | `memory_limbic_search`                        | Hybrid FTS when `query` set; list/filter when omitted                   |
| autobiographical | `memory_autobiographical_search`              | FTS on title + body; snippet return                                     |
| conversation     | `conversation_search` / `conversation_scroll` | Dialogue snippets; session filter on search; scroll for full context    |
| write (semantic) | `memory_remember` / semantic CRUD             | Not retrieval                                                           |

Habitat debug `memory.search` may query one or more scopes in parallel for operators; results are **concatenated by scope** (no cross-type RRF). Product LLM path uses the per-scope tools above.

### Resident Memory

Separate from retrieval tools: **pinned** semantic memories plus **most-referenced** entries are always injected into the system prompt. LLM cites memory ID markers in replies; reference counts sync via nightly cron.

## Relationship to Self Layer

Self layer (five blocks) is **not** retrieved via memory search tools—it is always in the system prompt.

| Layer        | Injection                          | Reason                                            |
| ------------ | ---------------------------------- | ------------------------------------------------- |
| Self layer   | Always in system prompt            | Small, fixed, every conversation needs "who I am" |
| Memory layer | Per-scope tools / passive semantic | Large, dynamic, search when needed                |

## Retired: Unified Recall

`memory_recall` (four-source RRF) is **removed**. Session/dialogue search stays on `conversation_search` only. Cross-resource “unified recall v2” ([Issue #47](https://github.com/freeanima-org/freeanima/issues/47)) remains not planned.

## Naming Rationale

In cognitive psychology, **Recall** is actively pulling stored information from memory. FreeAnima keeps the verb in docs; runtime tools are named by **scope** so the model routes intent without cross-type ranking collisions.

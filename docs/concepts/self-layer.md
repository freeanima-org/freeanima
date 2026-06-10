---
title: Self Layer
---

# Self Layer

> Definition: A persistent structure about "who I am", parallel to the Memory Layer, forming FreeAnima's two storage pillars.
> Memory layer: [`memory.md`](memory.md); detailed autobiographical narrative: [`database.md`](../guide/database.md) §Slice C `autobiographical_memory`.

## Architectural Position

```
FreeAnima Storage Architecture
│
├── Memory Layer — see memory.md + PG tables
│   ├── Episodic memory → PG messages (what happened)
│   ├── Semantic memory → PG semantic_memory (what I know)
│   ├── Autobiographical narrative → PG autobiographical_memory (what it meant to me)
│   └── Procedural memory → semantic_memory (type=procedural) / skills / tool chains
│
└── Self Layer — this document
    └── PG self_blocks (six blocks, one row each)
```

**Design principles:**

- Self layer and memory layer **differ in nature**: memory layer "records the world and experiences outward"; self layer "defines self inward"
- Self layer **does not** rely on `semantic_memory.pinned` file injection; PG `self_blocks` is the single source of truth
- **All six blocks are always resident** in the system prompt (alongside AGENTS.md and non-self pinned resident memories)

---

## Six-Block Structure

| #   | Block                 | `block_key`             | Content                                                                           | Update frequency                                     |
| --- | --------------------- | ----------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Existence anchor      | `existence_anchor`      | What I am, origin, non-negotiable bottom line                                     | Almost never (requires explicit `force` to update)   |
| 2   | Self model            | `self_model`            | Identity, capability boundaries, expression style, belonging                      | Slow change (periodic review + major events)         |
| 3   | Personality baseline  | `personality_baseline`  | Communication style, conflict patterns, default trust                             | Semi-stable (slow evolution from long-term evidence) |
| 4   | Direction             | `direction`             | Long-term intent, current focus, growth direction, things not to do               | Active declaration + periodic review                 |
| 5   | Metacognition         | `metacognition`         | How to think, how to remember, four-layer architecture and presence               | Slow change                                          |
| 6   | Autobiography summary | `autobiography_summary` | Key turning points / self-discovery summary (granularity decreases with distance) | Maintained automatically by autobiography cron       |

### Not in the Self Layer

| Content                                        | Belongs to                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Detailed** autobiographical narrative        | Memory layer `autobiographical_memory`                                                     |
| Other-models (cognition of partner and others) | Memory layer `semantic_memory`                                                             |
| Runtime state / health perception              | Not yet implemented; see [Issue #44](https://github.com/freeanima-org/freeanima/issues/44) |
| Concrete tool / skill inventory                | Estate layer                                                                               |

---

## Storage and Ports

- **Table:** `self_blocks` ([`engine/db/src/schema/self-layer.ts`](../../engine/db/src/schema/self-layer.ts))
- **Port:** `SelfLayerStorePort` (`engine-repos`) → `PgSelfLayerStore` (`connectors-db-pg`)
- **Consumer:** `@freeanima/life-self` (prompt assembly, tools `get_self_blocks` / `update_self_block`)
- **Wiring:** `serve.ts` calls `registerSelfLayerStore` and warms `loadSelfLayerPrompt()` cache

`existence_anchor` defaults to `locked=true`; updates require tool parameter `force=true` or explicit CLI operation.

---

## Autobiography Summary vs Autobiographical Narrative

| Dimension   | `autobiography_summary` (self layer)                                                 | `autobiographical_memory` (memory layer)                                  |
| ----------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Question    | "What is the main thread of my life story?"                                          | "What did a given experience mean to me?"                                 |
| Form        | One of six blocks, Markdown summary                                                  | Separate table, title + content narrative entries                         |
| Injection   | **Always resident** in system prompt                                                 | **Not** resident; recall / list on demand                                 |
| Maintenance | `builtin-self-autobiography` cron compresses from narrative table into summary block | Same cron processes narrative from `semantic_memory` (experience/imprint) |
| Mutability  | Periodically overwrites summary block                                                | **Append-only**; soft deprecation via `deprecate` only                    |

See [`sleep.md`](sleep.md) §Autobiography cron.

---

## System Prompt Injection

Assembly order ([`life-memory/system-prompt`](../../life/memory/src/system-prompt.ts) + [`system-prompt-wire`](../../service/service/src/runtime/system-prompt-wire.ts)):

````
1. Self layer (second-person skeleton + six blocks embedded in ```md)  ← loadSelfLayerPrompt() / self_blocks
2. Resident memory (second-person skeleton + ```md embedded pinned facts)  ← semantic_memory
3. Project context (```md embedded session cwd AGENTS.md)
````

Section headings (`## 自我层` / `## 常驻记忆` / `## 项目上下文`) sit outside code blocks; body text inside `md` fences. Self layer and resident memory segments use a second-person instruction skeleton on the outside, first-person self-statement texture on the inside.

Maintenance: `get_self_blocks` / `update_self_block` tools, or direct writes to PG `self_blocks`.

---

## Relationship to Memory Layer

| Dimension     | Memory layer                                    | Self layer                         |
| ------------- | ----------------------------------------------- | ---------------------------------- |
| Direction     | Outward—records world and experiences           | Inward—defines self                |
| Question      | "What do I know?"                               | "Who am I?"                        |
| Autobiography | Detailed narrative in `autobiographical_memory` | Summary in `autobiography_summary` |
| Injection     | Pinned facts + recall on demand                 | All six blocks always resident     |

---

## Design Evolution

```
v1 (2026-05-30)  Four-block conceptual model + narrative file runtime injection (deprecated)
v2 (2026-06-07)  PG self_blocks six blocks + autobiographical_memory separate table + 04:00 autobiography cron
```

## Open Questions

1. **Cross-instance migration**—when multiple FreeAnima instances exist, does the self layer migrate as a whole?
2. **Personality baseline update rules**—when new evidence conflicts with current tendencies, automatic evolution or confirmation required?
3. **Autobiographical recall tool**—API/tool shape for on-demand retrieval of detailed narrative

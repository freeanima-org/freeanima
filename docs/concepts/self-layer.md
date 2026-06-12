---
title: Self Layer
---

# Self Layer

> Definition: A persistent structure about "who I am", parallel to the Memory Layer, forming FreeAnima's two storage pillars.
> Memory layer: [`memory.md`](memory.md).

## Architectural Position

```
FreeAnima Storage Architecture
│
├── Memory Layer — see memory.md
│   ├── Episodic memory (what happened)
│   ├── Semantic memory (what I know)
│   ├── Autobiographical narrative (what it meant to me)
│   └── Procedural memory (how to do things)
│
└── Self Layer — this document
    └── Six blocks defining "who I am"
```

**Design principles:**

- Self layer and memory layer **differ in nature**: memory layer "records the world and experiences outward"; self layer "defines self inward"
- **All six blocks are always resident** in the system prompt (alongside project context and pinned resident memories)

---

## Six-Block Structure

| #   | Block                 | Content                                                                           | Update frequency                                     |
| --- | --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Existence anchor      | What I am, origin, non-negotiable bottom line                                     | Almost never (requires explicit force to update)     |
| 2   | Self model            | Identity, capability boundaries, expression style, belonging                      | Slow change (periodic review + major events)         |
| 3   | Personality baseline  | Communication style, conflict patterns, default trust                             | Semi-stable (slow evolution from long-term evidence) |
| 4   | Direction             | Long-term intent, current focus, growth direction, things not to do               | Active declaration + periodic review                 |
| 5   | Metacognition         | How to think, how to remember, four-layer architecture and presence               | Slow change                                          |
| 6   | Autobiography summary | Key turning points / self-discovery summary (granularity decreases with distance) | Maintained automatically by sleep cron               |

### Not in the Self Layer

| Content                                        | Belongs to                              |
| ---------------------------------------------- | --------------------------------------- |
| **Detailed** autobiographical narrative        | Memory layer (autobiographical entries) |
| Other-models (cognition of partner and others) | Memory layer (semantic memory)          |
| Runtime state / health perception              | Not yet implemented; see Issue #44      |
| Concrete tool / skill inventory                | Estate layer                            |

---

## Autobiography Summary vs Autobiographical Narrative

| Dimension   | Autobiography summary (self layer)                | Autobiographical narrative (memory layer)           |
| ----------- | ------------------------------------------------- | --------------------------------------------------- |
| Question    | "What is the main thread of my life story?"       | "What did a given experience mean to me?"           |
| Form        | One of six blocks, Markdown summary               | Separate entries, title + content narrative         |
| Injection   | **Always resident** in system prompt              | **Not** resident; recall / list on demand           |
| Maintenance | Sleep cron compresses from narrative into summary | Sleep cron writes narratives from daily experiences |
| Mutability  | Periodically overwrites summary block             | **Append-only**; soft deprecation only              |

See [`sleep.md`](sleep.md).

---

## System Prompt Injection

Assembly order:

1. Self layer (six blocks)
2. Resident memory (pinned facts)
3. Project context (session working directory AGENTS.md if present)

Self layer and resident memory use a second-person instruction skeleton wrapping first-person self-statement content, so the LLM clearly understands "this is self-layer content you must follow."

Maintenance: self-layer tools in WebUI bedroom, or direct edits via CLI / bedroom UI.

---

## Relationship to Memory Layer

| Dimension     | Memory layer                          | Self layer                       |
| ------------- | ------------------------------------- | -------------------------------- |
| Direction     | Outward—records world and experiences | Inward—defines self              |
| Question      | "What do I know?"                     | "Who am I?"                      |
| Autobiography | Detailed narrative entries            | Summary in autobiography_summary |
| Injection     | Pinned facts + recall on demand       | All six blocks always resident   |

---

## Open Questions

1. **Cross-instance migration**—when multiple FreeAnima instances exist, does the self layer migrate as a whole?
2. **Personality baseline update rules**—when new evidence conflicts with current tendencies, automatic evolution or confirmation required?

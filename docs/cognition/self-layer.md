---
title: Self Layer
---

# Self Layer

> Definition: A persistent structure about "who I am", parallel to the Memory Layer, forming FreeAnima's two storage pillars.
> Memory layer: [`memory.md`](memory.md).
> Objective time digests: [`temporal-summary.md`](temporal-summary.md).

## Architectural Position

```text
FreeAnima Storage Architecture
│
├── Memory Layer — see memory.md
│   ├── Episodic memory (what happened)
│   ├── Semantic memory (what I know)
│   ├── Autobiographical narrative (historical; extraction retired — read-only)
│   └── Procedural memory (how to do things)
│
└── Self Layer — this document
    └── Five blocks defining "who I am"
```

**Design principles:**

- Self layer and memory layer **differ in nature**: memory layer "records the world and experiences outward"; self layer "defines self inward"
- **All five blocks are always resident** in the system prompt (alongside project context and pinned resident memories)
- **Objective timelines** live in temporal summary, not in the self layer

---

## Five-Block Structure

| #   | Block                | Content                                                       | Update frequency                                 |
| --- | -------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Existence anchor     | What I am, origin, non-negotiable bottom line                 | Almost never (requires explicit force to update) |
| 2   | Self model           | Identity, capability boundaries, expression style, belonging  | Slow (weekly proposal + partner confirmation)    |
| 3   | Personality baseline | Communication style, conflict patterns, default trust         | Semi-stable (same slow proposal path)            |
| 4   | Direction            | Long-term intent, current focus, growth direction, not-to-dos | Active declaration + slow proposal path          |
| 5   | Metacognition        | How to think, how to remember, architecture and presence      | Slow change (same slow proposal path)            |

### Automatic maintenance (slow)

Sleep-cycle step `self-layer-refresh` (CST Monday, after deep-sleep + memory-ref-sync):

1. Load **resident semantic memory** only (pinned ∪ high `reference_count`, `active`)
2. LLM may propose updates to the four maintainable blocks (never `existence_anchor`)
3. On proposal: write **agent Inbox** notification (`source_ref=self-layer-proposal`); **no silent write**
4. When the partner is present, unread inject → agent asks → on approval `self_update_block` → `notification_mark_read`

Restraint: insufficient evidence or pending unread proposal → skip.

### Not in the Self Layer

| Content                                        | Belongs to                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Objective day/month/year digests               | Temporal summary — see [`temporal-summary.md`](temporal-summary.md)              |
| **Detailed** autobiographical narrative        | Memory layer (historical entities; extraction stopped — read-only)               |
| Other-models (cognition of partner and others) | Memory layer (semantic memory)                                                   |
| Runtime state / health perception              | Estate / env-health — see [`environment-awareness.md`](environment-awareness.md) |
| Concrete tool / skill inventory                | Estate layer — skills: [`skills.md`](../modules/skills.md)                       |

---

## Autobiographical narrative (memory layer, retired extraction)

Light sleep **no longer** extracts new autobiographical narratives or maintains a self-layer autobiography summary. Existing narrative entities remain queryable via recall tools. Subjective “life story outline” is no longer a resident self block — use temporal summary for time awareness and the five self blocks for identity.

---

## System Prompt Injection

Assembly order:

1. Self layer (five blocks)
2. World / channel / toolsets (runtime hooks)
3. Environment + health baseline (static session copy; see [`environment-awareness.md`](environment-awareness.md))
4. Resident memory (pinned facts)
5. Project context (session working directory AGENTS.md if present)

Self layer and resident memory use a second-person instruction skeleton wrapping first-person self-statement content, so the LLM clearly understands "this is self-layer content you must follow."

Live environment/health **changes** are not rewritten into an existing session prompt; they surface as Inbox notifications (event-level).

Maintenance: Habitat self-layer tools / UI, or slow automatic proposals via agent Inbox.

---

## Relationship to Memory Layer

| Dimension     | Memory layer                          | Self layer                      |
| ------------- | ------------------------------------- | ------------------------------- |
| Direction     | Outward—records world and experiences | Inward—defines self             |
| Question      | "What do I know?"                     | "Who am I?"                     |
| Time overview | Temporal summary (objective)          | Not a self block                |
| Injection     | Pinned facts + recall on demand       | All five blocks always resident |

---

## Open Questions

1. **Cross-instance migration**—when multiple FreeAnima instances exist, does the self layer migrate as a whole?

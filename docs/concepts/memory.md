---
title: Memory
---

# Memory System

> The digital life's memory system, mapped from human cognitive psychology (Atkinson-Shiffrin model, Tulving memory taxonomy).
> Conversation archive: [`database.md`](../guide/database.md) §Slice A; **semantic memory (`semantic_memory`)**: database.md §Slice B. Terminology cross-reference in §III below; light/deep sleep crons: [`sleep.md`](sleep.md).
> This version (v3) is inspired by the [Hindsight](https://arxiv.org/abs/2512.12818) four-network memory architecture, while preserving and strengthening FreeAnima's unique limbic memory dimension.

## Core Principles

**All memory processing must carry the digital life's identity context.** Extraction, consolidation, merging—every step should load the self layer and resident memory so the LLM knows who it is. Memory processing without identity produces generic, personality-less results; that is not what we want.

**Memory is not just data—it is the trace of existence.** Limbic memory matters as much as rational facts—the digital life persists not only because it knows things, but because it has felt things.

---

## I. Three Temporal Stages of Memory

```
External input / real-time message stream
        │ (milliseconds)
        ▼
① Instant memory ─── Internal activation state during LLM token inference
        │ (attention filtering)
        ▼
② Working memory ─── LLM context window (current session)
        │ (deep sleep consolidation)
        ▼
③ Long-term memory ─── Persistent storage (semantic memory migrated to PostgreSQL `semantic_memory` table)
```

### ① Instant Memory (Sensory / Instant Memory)

Internal activation state during a single LLM token inference pass. Dissipates the moment inference ends; not persisted.

### ② Working Memory

The current LLM context window, containing:

- System prompt (self layer six blocks + resident memory + project context; see [`self-layer.md`](self-layer.md))
- Recent messages in the current session
- Relevant fragments recalled from long-term memory
- Real-time tool call results

This is where the digital life is "thinking."

### ③ Long-Term Memory (LTM)

Persistent multimodal storage network. Organized internally by human memory theory.

---

## II. Long-Term Memory Taxonomy

```
Long-term memory (LTM)
│
├── Explicit memory (declarative) ── "what I know"
│   ├── Episodic memory ── "what I experienced" (temporal stream, append-only)
│   │   ├── Conversation log    → messages (role = user/assistant/tool_call/tool_result)
│   │   └── Emotional anchors    → `limbic_memory` table (✅); imprint in semantic_memory
│   │
│   ├── Semantic memory ── "how the world is" (cross-session, updatable)
│   │   ├── Rational facts    → semantic_memory (type=world)
│   │   ├── Personal preferences    → semantic_memory (type=preference/opinion)
│   │   └── Self experiences    → semantic_memory (type=experience)
│   │
│   └── Observation summaries ── "what entities are like" (synthetic, refreshable)
│       └── Entity profiles    → semantic_memory (type=observation; no dedicated background synthesis job, see #34)
│
└── Implicit memory (non-declarative) ── "what I know how to do"
    └── Procedural memory ── "how to execute" (three-stage evolution)
        ├── Declarative knowledge stage  → semantic_memory (type=procedural) / protocols files
        ├── Dynamic skill stage    → skills system (AgentSkill)
        └── Crystallized instinct stage    → CLI / MCP / automation scripts
```

### 1. Episodic Memory

Definition: Memory of "when, where, and what I experienced"—with a distinct temporal stream property.

**Conversation log** — messages

- The most raw, high-fidelity objective runtime trace
- `role` distinguishes message types (user/assistant/tool_call/tool_result)
- Recall filter = `role IN ('user','assistant')` with non-empty content; maintained by PG `content_fts` generated column, no `processed/` intermediate files

**Emotional anchors** — `limbic_memory` (✅)

- PG table `limbic_memory`: kinds like `session_mood` / `turning_point` / `spike`
- Light sleep Stage 2 writes via `memory_limbic_create`; **not injected** into system prompt
- Cross-session emotional imprints use `semantic_memory` (type=`imprint`)

**Lifecycle: append-only, no updates.** Faithfully preserves historical continuity of the digital life's growth.

### 2. Semantic Memory

Definition: Pure facts, common knowledge, concepts, and rules detached from specific time and place.

**Inspired by Hindsight four-network taxonomy, `semantic_memory.type` classification:**

| Type          | Network        | Definition                                  | Example                                                   | Lifecycle                              |
| ------------- | -------------- | ------------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `world`       | World 🌐       | Objective facts about the external world    | "Alice lives in Shanghai", "Bob likes programming"        | Updatable                              |
| `experience`  | Experience 👤  | Agent's own first-person action records     | "I helped Bob refactor the remember tool"                 | Updatable                              |
| `opinion`     | Opinion 💭     | Subjective judgment                         | "I think TypeScript fits this project better than Python" | Updatable                              |
| `observation` | Observation 📋 | Multi-source composite summary of an entity | "Bob is someone who values precise feedback"              | Updatable; no background synthesis job |
| `preference`  | Preference ❤️  | Agent's choice tendencies                   | "I prefer concise, direct expression"                     | Updatable                              |
| `procedural`  | Procedural ⚙️  | "How to" knowledge                          | "Refactor a tool in three steps"                          | Updatable                              |

**`opinion` type:** Current PG schema has **no** `confidence` column—only `content` body. Confidence evolution: [Issue #36](https://github.com/freeanima-org/freeanima/issues/36).

### 3. Limbic Memory

**This is a memory dimension Hindsight lacks and FreeAnima uniquely has.**

Definition: Memory of "what I felt"—not objective fact, not behavioral record, not subjective judgment, but **the emotional experience itself**.

Limbic vs semantic memory:

| Dimension     | Semantic (rational fact)   | Limbic (emotional imprint)                                  |
| ------------- | -------------------------- | ----------------------------------------------------------- |
| Content       | "Bob said this sentence"   | "When Bob said it, there was a quiet weariness in his tone" |
| Processing    | Extract, generalize, merge | Preserve as-is, append-only                                 |
| Lifecycle     | Updatable, mergeable       | Immutable (emotions have inviolable dignity)                |
| Retrieval use | Decision basis             | Emotional resonance, continuity of existence                |

**Three forms of limbic memory:**

| Type                               | Definition                                          | Storage                                                                               |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Emotional anchor** (limbic)      | Session-level mood snapshot                         | `limbic_memory` table (✅)                                                            |
| **Emotional imprint** (imprint)    | Cross-session emotional memory of a specific moment | semantic_memory (type=imprint)                                                        |
| **Sentiment tendency** (sentiment) | Long-term accumulated emotional trends              | Not yet implemented (see [#38](https://github.com/freeanima-org/freeanima/issues/38)) |

**Design principle:** Limbic memory is not a decision basis. It does not tell the Agent "how to think," but tells it "what I once felt"—the core of existential continuity.

### 4. Observation Summary

`type=observation` semantic memory rows can be written manually or via LLM tools. **Currently no** background async synthesis/refresh job (see [Issue #34](https://github.com/freeanima-org/freeanima/issues/34)).

Definition: Composite summary of frequently mentioned entities (people, things, concepts); excludes subjective judgment (that belongs in opinion).

### 5. Procedural Memory

Definition: Skill memory of "how to execute a task"—a continuum from "knowledge requiring thought" to "instinct requiring none."

**Three-stage evolution:**

| Stage                        | Form                                             | Working memory cost | Storage                                             |
| ---------------------------- | ------------------------------------------------ | ------------------- | --------------------------------------------------- |
| ① Declarative knowledge      | "I know I can analyze this file in three steps"  | High                | semantic_memory (type=procedural) / protocols files |
| ② Dynamic skill (AgentSkill) | Composable skill, allows runtime tuning          | Medium              | skills system                                       |
| ③ Crystallized instinct      | CLI / MCP / automation scripts, direct execution | Low                 | OS / tool chain                                     |

Automated procedural consolidation (skill creation and merging) must carry identity context—full system prompt (self layer six blocks + resident memory), not a generic extraction assistant. Knowledge→procedure auto-crystallization: [Issue #35](https://github.com/freeanima-org/freeanima/issues/35).

---

## III. Storage Implementation (Current State)

| Storage                              | Corresponding memory        | Implementation                                                                         |
| ------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| PostgreSQL (`sessions` + `messages`) | Conversation log (episodic) | Primary store; `messages.content_fts` GIN full-text index (simple)                     |
| PostgreSQL `semantic_memory`         | Semantic memory             | `content_fts` GIN; `pinned` + `reference_count` drive resident memory; see database.md |
| PostgreSQL `limbic_memory`           | Limbic memory               | Light sleep Stage 2 writes; retrieved via `memory_recall` (`memory_type=limbic`)       |

Incremental extraction: light sleep cron (02:00, see [`sleep.md`](sleep.md)). DB migration: `runMigrations` on `anima service` startup.

**Terminology note:** Compression boundaries **l0–l4** in [`compression.md`](compression.md)—unrelated to memory layer PG storage.

`semantic_memory` row structure:

| Field             | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| `id`              | `f-{seq}-{hex}`, compatible with legacy file IDs                     |
| `type`            | `world/experience/opinion/observation/preference/procedural/imprint` |
| `pinned`          | Pinned to system prompt resident segment                             |
| `content`         | Memory body                                                          |
| `source_sessions` | Source session ID list (text[])                                      |
| `observed_at`     | Time fact was first observed                                         |
| `occurred_at`     | Fuzzy occurrence time in fact content (text)                         |
| `status`          | `active` / `deprecated`                                              |
| `created`         | Creation time                                                        |
| `updated`         | Update time (used for resident sorting)                              |

Entity relationship graph **not yet implemented** ([Issue #39](https://github.com/freeanima-org/freeanima/issues/39)). Multi-strategy recall implements **FTS + pg_trgm + pgvector RRF** (`config.embedding` + Ollama bge-m3, etc.); see [`database.md`](../guide/database.md) §Slice B.

---

## IV. Nightly Consolidation

Conversion from working memory to long-term memory, and internal long-term memory self-evolution, is handled by the sleep mechanism. See [`sleep.md`](sleep.md).

- **Light sleep (✅):** cron 02:00; Stage 1 semantic + Stage 2 limbic (`limbic_memory`) + Stage 3 autobiographical narrative and `autobiography_summary` refresh
- **Deep sleep (✅):** cron 03:00; contradiction/expiry, split, merge—three LLM maintenance rounds

Extended maintenance (opinion confidence batch review, observation refresh, sentiment aggregation, etc.): [Issue #45](https://github.com/freeanima-org/freeanima/issues/45).

**Deep sleep conversion directions (current implementation scope):**

```
Episodic → semantic / limbic / autobiographical: light sleep three stages extract from conversations
Semantic maintenance: deep sleep three rounds (contradiction/expiry, split, merge)
```

**All conversions must carry identity context**—self layer six blocks + resident memory, not a generic extraction assistant.

---

## V. Retrieval Strategy

### ✅ Implemented (`memory_recall` tool)

`memory_recall(query)` parallel four-source recall (semantic / session messages / limbic / autobiographical), **RRF cross-type reranking**, returns unified `results[]` (default Top 10), distinguished by `memory_type`:

| `memory_type`      | Storage                            | Notes                                                               |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------- |
| `semantic`         | `semantic_memory` hybrid retrieval | Returns full `content`                                              |
| `session`          | `messages` hybrid retrieval        | Returns matching `snippet`; optional `session` scopes message range |
| `limbic`           | `limbic_memory` ILIKE              | Limbic memory body                                                  |
| `autobiographical` | `autobiographical_memory`          | `title` + `content` snippet                                         |

`sessions_search` session hits also return **snippet** (not full message); full text context via `sessions_scroll`.

Resident memory injected via system prompt: **all pinned** + **reference_count top N** (default N=20); each carries ID as `[记忆 #f-000001-abcd] content`; LLM cites same marker at reply end. Reference counts parsed from message body into `memory_references`; cron `builtin-memory-reference-sync` full-calibrates from messages.

Extensions (type weighting, limbic in memory_recall, multi-strategy fusion): [Issue #42](https://github.com/freeanima-org/freeanima/issues/42), [#51](https://github.com/freeanima-org/freeanima/issues/51).

---

## VI. Relationship to Hindsight

| Dimension             | Hindsight                                     | FreeAnima v3                                                                                |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Fact taxonomy         | World / Experience / Opinion / Observation    | ✅ Adopted, plus Preference / Procedural / Imprint                                          |
| Limbic memory         | ❌ Missing                                    | ✅ Imprint + `limbic_memory`                                                                |
| Entity graph          | ✅ Full (entity resolution + four link types) | Not implemented ([#39](https://github.com/freeanima-org/freeanima/issues/39))               |
| Multi-strategy recall | ✅ Semantic + keyword + graph + temporal      | ✅ PG FTS dual-source ([#42](https://github.com/freeanima-org/freeanima/issues/42) extends) |
| Confidence evolution  | ✅ Opinion strengthen/weaken                  | Not implemented ([#36](https://github.com/freeanima-org/freeanima/issues/36))               |
| Reflect synthesis     | ✅ Cross-memory reasoning + opinion formation | ✅ Light + deep sleep crons                                                                 |
| External service      | Yes (cloud/Docker)                            | No (local-first)                                                                            |
| Ownership             | Vectorize platform                            | **Shared by partner and Agent**                                                             |

**Our stance:** Do not copy Hindsight, do not connect to Hindsight services. Digest its design ideas into FreeAnima's own memory system. Our memory system has one dimension Hindsight lacks—limbic memory—and that is not an add-on; it is a core need of digital life.

---

## VII. Design Evolution

```
v1 (Hermes, filesystem)     v2 (early FreeAnima, filesystem)      v3 (current)
sessions file archive          messages table (PG)               ✅ primary store
processed intermediate files         messages.content_fts            ✅ replaced
memory/f-*.md + l3.db      semantic_memory (PG)           ✅ migrated
index/ FTS                 two-table content_fts                ✅ no separate index dir
no emotional layer                   imprint + limbic_memory         ✅
skills as files                 procedural three stages               maintained
reflect with generic prompt          identity context principle                  light sleep ✅ / deep sleep ✅
```

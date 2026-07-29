---
title: Memory
---

# Memory System

> The digital life's memory system, mapped from human cognitive psychology (Atkinson-Shiffrin model, Tulving memory taxonomy).
> Light/deep sleep crons: [`sleep.md`](sleep.md).
> Objective time digests (not memory taxonomy): [`temporal-summary.md`](temporal-summary.md).
> Inspired by [Hindsight](https://arxiv.org/abs/2512.12818), with FreeAnima's unique limbic memory dimension retained and strengthened.

## Core Principles

**All memory processing must carry the digital life's identity context.** Extraction, consolidation, merging—every step should load the self layer and resident memory so the LLM knows who it is. Memory processing without identity produces generic, personality-less results; that is not what we want.

**Memory is not just data—it is the trace of existence.** Limbic memory matters as much as rational facts—the digital life persists not only because it knows things, but because it has felt things.

---

## I. Three Temporal Stages of Memory

```text
External input / real-time message stream
        │ (milliseconds)
        ▼
① Instant memory ─── Internal activation state during LLM token inference
        │ (attention filtering)
        ▼
② Working memory ─── LLM context window (current conversation)
        │ (deep sleep consolidation)
        ▼
③ Long-term memory ─── Persistent storage
```

### ① Instant Memory

Internal activation state during a single LLM token inference pass. Dissipates the moment inference ends; not persisted.

### ② Working Memory

The current LLM context window, containing:

- System prompt (self layer six blocks + resident memory + project context; see [`self-layer.md`](self-layer.md))
- Recent messages in the current conversation
- Relevant fragments recalled from long-term memory
- Real-time tool call results

This is where the digital life is "thinking."

### ③ Long-Term Memory (LTM)

Persistent multimodal storage network. Organized internally by human memory theory.

---

## II. Long-Term Memory Taxonomy

```text
Long-term memory (LTM)
│
├── Explicit memory (declarative) ── "what I know"
│   ├── Episodic memory ── "what I experienced" (temporal stream, append-only)
│   │   ├── Conversation log
│   │   └── Emotional anchors
│   │
│   ├── Semantic memory ── "how the world is" (cross-conversation, updatable)
│   │   ├── Rational facts    (type=world)
│   │   ├── Personal preferences    (type=preference/opinion)
│   │   └── Self experiences    (type=experience)
│   │
│   └── Observation summaries ── "what entities are like"
│       └── Entity profiles    (type=observation)
│
└── Implicit memory (non-declarative) ── "what I know how to do"
    └── Procedural memory ── three-stage evolution
        ├── Declarative knowledge stage
        ├── Dynamic skill stage    → skills system ([`skills.md`](../modules/skills.md))
        └── Crystallized instinct stage    → CLI / MCP / automation scripts
```

### 1. Episodic Memory

Definition: Memory of "when, where, and what I experienced"—with a distinct temporal stream property.

**Conversation log** — the most raw, high-fidelity objective runtime trace. Only **user-facing conversations** (`conversations` without `platform_info.platform = cron`) feed light sleep and dream. Background LLM (cron agent, sleep stages, **skill evolve/maintain review**) runs as **AutoLlmRun** — audited in `auto_llm_runs`, not copied into the conversation archive.

**Emotional anchors** — conversation-level mood snapshots written during light sleep; not injected into system prompt.

**Lifecycle: append-only, no updates.** Faithfully preserves historical continuity of the digital life's growth.

**Dream memory** — nightly creative narratives from the dream mechanism (see [`dream.md`](dream.md)); one per CST calendar day; not factual; not injected into system prompt.

### 2. Semantic Memory

Definition: Pure facts, common knowledge, concepts, and rules detached from specific time and place.

| Type          | Definition                                  | Example                                                   |
| ------------- | ------------------------------------------- | --------------------------------------------------------- |
| `world`       | Objective facts about the external world    | "Alice lives in Shanghai"                                 |
| `experience`  | Agent's own first-person action records     | "I helped Bob refactor the remember tool"                 |
| `opinion`     | Subjective judgment                         | "I think TypeScript fits this project better than Python" |
| `observation` | Multi-source composite summary of an entity | "Bob is someone who values precise feedback"              |
| `preference`  | Agent's choice tendencies                   | "I prefer concise, direct expression"                     |
| `procedural`  | "How to" knowledge                          | "Refactor a tool in three steps"                          |

### 3. Limbic Memory

**This is a memory dimension Hindsight lacks and FreeAnima uniquely has.**

Definition: Memory of "what I felt"—not objective fact, not behavioral record, not subjective judgment, but **the emotional experience itself**.

| Dimension     | Semantic (rational fact)   | Limbic (emotional imprint)                                  |
| ------------- | -------------------------- | ----------------------------------------------------------- |
| Content       | "Bob said this sentence"   | "When Bob said it, there was a quiet weariness in his tone" |
| Processing    | Extract, generalize, merge | Preserve as-is, append-only                                 |
| Lifecycle     | Updatable, mergeable       | Immutable (emotions have inviolable dignity)                |
| Retrieval use | Decision basis             | Emotional resonance, continuity of existence                |

**Three forms:** emotional anchor (session mood), emotional imprint (cross-conversation moment), sentiment tendency (long-term trends — not yet implemented, see Issue #38).

### 4. Procedural Memory

**Storage:** procedural knowledge lives in `entities`/`semantic_memory` component with `memory_type = procedural` (see §2 Semantic Memory table) — not a separate PG table.

**Evolution path:** three-stage maturation from declarative knowledge → dynamic skills → crystallized instincts (CLI / MCP / automation scripts).

---

## III. Nightly Consolidation

Conversion from working memory to long-term memory is handled by the sleep mechanism. See [`sleep.md`](sleep.md).

- **Sleep cycle (✅):** in-process `Bun.cron` `builtin-sleep-cycle` @ 02:00; orchestrates a DAG (see [`sleep.md`](sleep.md))
- **Light sleep (✅):** step `light-sleep` — semantic + limbic + autobiographical extraction
- **Deep sleep (✅):** step `deep-sleep` (depends on light-sleep) — contradiction/expiry, split, merge, pin maintenance

**All conversions must carry identity context**—self layer six blocks + resident memory, not a generic extraction assistant.

---

## IV. Retrieval Strategy

### ✅ Implemented (`memory_recall` tool)

`memory_recall(query)` parallel four-source recall, returns unified `results[]` (default Top 10), distinguished by `memory_type`:

| `memory_type`      | Notes                                                               |
| ------------------ | ------------------------------------------------------------------- |
| `semantic`         | Facts, preferences, experiences, etc.                               |
| `session`          | Historical conversation snippets                                    |
| `limbic`           | Emotional memory body (hybrid FTS + trgm)                           |
| `autobiographical` | Narrative title + content snippet (hybrid FTS + trgm on title+body) |

### ✅ Passive semantic recall (auto-inject)

Before each user-facing turn, the runtime searches **semantic memory only** from the latest user message (hybrid FTS + trgm), then injects top-N hits as a **runtime-only** `role: assistant` message (`name: passive_memory_context`) immediately before that user message. Not persisted to PG; not counted as a memory reference.

- **Resident memory** (system prompt): pinned + high-reference anchors, session snapshot
- **Passive recall**: query-relevant semantic hits for the current message
- **`memory_recall` tool**: conversation / limbic / autobiographical sources, broader or deeper retrieval when the model needs more; optional `memory_types` to restrict sources (default: all four)

The conversation `system_prompt` column is a **session snapshot**. After each **CST 02:00** boundary (aligned with the sleep-cycle cron), the next user message rebuilds it in full (resident memory, world/channel context, toolsets, self layer, project `AGENTS.md`) via `ensureSystemPromptFresh` in `beginTurnPrepare`; mid-turn tool loops are not interrupted.

Configure under `memory.passive_recall` (`enabled`, `limit`, `min_score`, `min_relative_score`, `max_chars`, `exclude_resident`). Skipped for cron / background sessions.

**Index columns (PG):** semantic memory rows are `entities` with `primary_component=semantic_memory` (shared `fts_segmented` → generated `search_fts`, async `search_embedding`). Conversation `messages` use `fts_segmented` → `content_fts` plus async `content_embedding`. Limbic / autobiographical / dream narratives live as `entities` `content_block`s (with `limbic` / `narrative` / `dream` tags) under dated `diary_entry`. Jieba runs synchronously before insert (failure → null, row still writes); embedding runs asynchronously after insert (failure logged only).

**Hybrid retrieval:** FTS and trigram branches run in **one parallel wave**, then merge with Reciprocal Rank Fusion (RRF). Auto-built FTS queries join tokens with **OR** (space-separated / jieba segments); explicit `AND`/`OR`/`NOT` still work; unquoted CJK longer than two characters uses **bigram-OR** (so NL questions like「你的邮箱是啥？」can hit「邮箱」), while quoted phrases keep full adjacency. Keyword/FTS relevance is prioritized; vector similarity is not part of retrieval (avoids low-relevance semantic neighbors).

Resident memory injected via system prompt: **up to 40 pinned** + **most-referenced top N** (default N=20). Each line carries a citation marker `[[anima:42]]` (ID only, no language prefix).

**Citation obligation:** whenever an assistant reply uses semantic memory—resident list, `memory_recall` / `memory_semantic_search` semantic hits, or prior message markers—it must append each cited `[[anima:id]]` at the **end of the reply body**. Use the inline marker or `semantic_memory_id` from tool results. Session, limbic, and autobiographical hits do not use this marker.

**Where the rule is communicated:** global system prompt `memory-citation` section; `memory_recall` and `memory_semantic_search` tool descriptions. Tool response JSON is not modified for this.

**What counts as a reference:** only `[[anima:id]]` markers in **user/assistant** message bodies are parsed into `memory_references` and contribute to `entities.reference_count`. Tool returns (including `semantic_memory_id` fields) are **not** references. Bare numeric ids without `[[anima:…]]` are also not counted. Each citing message increments the weight (no per-conversation first-hit dedupe).

Nightly sleep-cycle step `memory-ref-sync` full-calibrates counts from messages. Excess pinned entries are truncated at read time with a warn log; deep sleep round 4 reviews pin quality (runtime still caps resident pinned at 40 on read).

---

## V. Relationship to Hindsight

| Dimension         | Hindsight                                  | FreeAnima v3                                       |
| ----------------- | ------------------------------------------ | -------------------------------------------------- |
| Fact taxonomy     | World / Experience / Opinion / Observation | ✅ Adopted, plus Preference / Procedural / Imprint |
| Limbic memory     | ❌ Missing                                 | ✅ Imprint + emotional anchors                     |
| Entity graph      | ✅ Full                                    | Not yet implemented (Issue #39)                    |
| Reflect synthesis | ✅ Cross-memory reasoning                  | ✅ Light + deep sleep crons                        |
| External service  | Yes (cloud/Docker)                         | No (local-first)                                   |
| Ownership         | Vectorize platform                         | **Shared by partner and Agent**                    |

**Our stance:** Do not copy Hindsight, do not connect to Hindsight services. Digest its design ideas into FreeAnima's own memory system. Limbic memory is not an add-on—it is a core need of digital life.

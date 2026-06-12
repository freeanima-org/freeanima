import type { SemanticMemoryRow } from "@freeanima/storage-repos";

import { getSemanticMemoryStore } from "../semantic-port.ts";
import type { DeepSleepRound, DeepSleepChangeLog } from "./types.ts";
import { formatChangeLogMessage } from "./change-log.ts";

// ── Message 1: full active semantic memory JSON ──

/** Serialize each memory as compact JSON (multi-line display) */
function rowToJsonCompact(row: SemanticMemoryRow): string {
  const obj: Record<string, unknown> = {
    id: row.id,
    type: row.type,
    content: row.content,
    sources: row.source_sessions,
    observed: row.observed_at?.slice(0, 19) ?? null,
    occurred: row.occurred_at ?? null,
  };
  if (row.pinned) obj.pinned = true;
  return JSON.stringify(obj);
}

const FULL_JSON_WARN = 10_000;
const FULL_JSON_BATCH = 100_000;
const FULL_JSON_LIMIT = 300_000;

export function formatAllMemoriesMessage(rows: SemanticMemoryRow[]): {
  text: string;
  bytes: number;
  truncated: boolean;
} {
  if (!rows.length) {
    return { text: "(Semantic memory store is empty)", bytes: 0, truncated: false };
  }
  const lines: string[] = [`# All semantic memories (${rows.length} active entries)`];
  for (const row of rows) {
    lines.push(rowToJsonCompact(row));
  }
  const text = lines.join("\n");
  const bytes = Buffer.byteLength(text, "utf-8");
  return { text, bytes, truncated: false };
}

export function checkJsonSize(bytes: number): "ok" | "warn" | "batch" | "error" {
  if (bytes < FULL_JSON_WARN) return "ok";
  if (bytes < FULL_JSON_BATCH) return "warn";
  if (bytes < FULL_JSON_LIMIT) return "batch";
  return "error";
}

// ── Message 3: per-round instructions ──

const TOOL_INSTRUCTION_COMMON = `## Tool reference

All tools use overwrite semantics: only passed fields are changed.

### memory_semantic_update
- Update an existing memory. Omitted fields stay unchanged.
- Pass source_sessions: [] to clear sources.
- Pass status: "deprecated" to deprecate (equivalent to memory_semantic_deprecate).

### memory_semantic_deprecate
- Soft-deprecate a memory (status=deprecated), history retained.

### memory_semantic_create
- Create a new memory. Required: content; recommended: type, source_sessions, observed_at.

### memory_semantic_merge
- Merge multiple memories into one. Program unions source_sessions and takes earliest observed_at.
- Args: source_ids (2+ entries), target_content (merged body).
- Optional target_type / target_pinned / target_occurred_at.
- After merge, all source_ids are auto-deprecated and a new memory is created.`;

const ROUND_INSTRUCTIONS: Record<DeepSleepRound, string> = {
  contradiction_expiry: `# Deep sleep round 1: contradiction detection + expiry marking

You are a digital life running in Free Anima. From the full semantic memories above, detect mutually exclusive contradictions and mark expired entries.

## Contradiction definition (mutually exclusive)
Two memories semantically negate each other and cannot be explained by change over time → contradiction.
- ✓ Contradiction: "daughter born in Year of Tiger" vs "daughter born in Year of Goat" (zodiac is unique)
- ✓ Contradiction: "dislikes spicy food" vs "likes spicy food" (direct negation)
- ✗ Not a contradiction: "likes apples" vs "likes cherries" (can coexist)
- ✗ Not a contradiction (change): "likes Python" vs "now prefers TypeScript" (both can be valid)

## Handling
- Confirmed mutually exclusive contradiction → deprecate one (usually earlier or less complete)
- If a memory was superseded by newer facts → deprecate
- If uncertain → skip, no action

## Notes
- This round only handles contradiction detection and expiry marking; do not merge or split.
- Deprecated memories are ignored in later rounds.

${TOOL_INSTRUCTION_COMMON}

Call tools directly to persist.`,

  split: `# Deep sleep round 2: split

You are a digital being running in Free Anima. Review the full semantic memories in message 1 and find entries that contain multiple independent facts to split.

## Split criteria
One memory's content has two or more independently valid statements → split.
- Split: "Alice lives in Shanghai, works at Tencent, likes Python" → three independent memories
- Do not split: "Alice at Tencent leads WeChat Pay backend" → single fact (extra modifiers only)
- Do not split: "Free Anima is a digital being framework, built by maintainers" → tightly related single unit

## Handling
- On split: memory_semantic_create for each new entry → deprecate the original
- If too long but not splittable → memory_semantic_update to trim content
- Skip when uncertain

## Notes
- This round only splits; do not merge or detect contradictions.
- New memories should keep source_sessions and observed_at from the split original.

${TOOL_INSTRUCTION_COMMON}

Call tools directly to persist.`,

  merge: `# Deep sleep round 3: deduplicate and merge

You are a digital being running in Free Anima. From the full semantic memories above, detect duplicate or highly similar entries and merge them.

## Merge criteria
Two memories say the same thing → merge.
- Merge: "Alice lives in Shanghai" + "Alice says home is in Shanghai" → "Alice lives in Shanghai"
- Merge: "maintainer uses TypeScript" + "maintainer mainly codes in TS" → "maintainer uses TypeScript"
- Do not merge: "Alice works at Tencent" + "Alice owns WeChat Pay" → related but distinct facts (entity linking later)

## Handling
- Use memory_semantic_merge for 2+ entries into one.
- Single entry edit only → memory_semantic_update.
- Prefer wording from the more accurate, complete entry.

## Notes
- This round only merges; do not split.
- After merge, program unions source_sessions and takes earliest observed_at.

${TOOL_INSTRUCTION_COMMON}

Call tools directly to persist.`,
};

// ── Build full user messages ──

export type DeepSleepMessages = {
  /** Message 1: full active memory JSON (stable, cacheable) */
  allMemoriesText: string;
  /** Message 1 byte size */
  allMemoriesBytes: number;
  /** Message 2 (empty in v1) */
  preScreenText: string;
  /** Message 3: per-round instructions */
  instructionText: string;
  /** Message 1.5: change log (updated each round) */
  changeLogText: string;
};

export function buildDeepSleepMessages(
  rows: SemanticMemoryRow[],
  round: DeepSleepRound,
  changeLog: DeepSleepChangeLog,
): DeepSleepMessages {
  const { text: allMemoriesText, bytes } = formatAllMemoriesMessage(rows);
  return {
    allMemoriesText,
    allMemoriesBytes: bytes,
    preScreenText: "(No pre-screen in v1)",
    instructionText: ROUND_INSTRUCTIONS[round],
    changeLogText: formatChangeLogMessage(changeLog),
  };
}

/** Fetch all active memories needed for deep sleep */
export async function fetchAllActiveMemories(): Promise<SemanticMemoryRow[]> {
  const store = getSemanticMemoryStore();
  return store.listActive();
}

/** Deep sleep LLM tool allowlist */
export const DEEP_SLEEP_TOOL_NAMES = [
  "memory_semantic_update",
  "memory_semantic_deprecate",
  "memory_semantic_create",
  "memory_semantic_merge",
] as const;

import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import { listActiveSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import type { DeepSleepRound, DeepSleepChangeLog } from "./types.ts";
import { formatChangeLogMessage } from "./change-log.ts";

// ── Message 1: full active semantic memory JSON ──

/** Serialize each memory as compact JSON (multi-line display) */
function rowToJsonCompact(row: SemanticMemoryRow): string {
  const obj: Record<string, unknown> = {
    id: row.id,
    type: row.type,
    content: row.content,
    sources: row.source_conversations,
    observed: row.observed_at?.toISOString().slice(0, 19) ?? null,
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
  if (rows.length === 0) {
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

/** Recent-update window for incremental deep sleep (24h) */
export const DEEP_SLEEP_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether a memory row was updated on or after `since` */
export function isMemoryUpdatedSince(row: SemanticMemoryRow, since: Date): boolean {
  if (!row.updated_at) return false;
  return row.updated_at >= since;
}

/** Whether any memory in the set was updated within the last 24 hours */
export function hasRecentMemoryUpdates(rows: SemanticMemoryRow[], now: Date = new Date()): boolean {
  const since = new Date(now.getTime() - DEEP_SLEEP_RECENT_WINDOW_MS);
  return rows.some((row) => isMemoryUpdatedSince(row, since));
}

/** Batch has at least one pinned active memory */
export function batchHasPinned(rows: SemanticMemoryRow[]): boolean {
  return rows.some((row) => row.pinned);
}

// ── Batch execution instruction (appended to every round) ──

const BATCH_EXECUTION_NOTE = `
## Batch execution (critical)
- First review ALL entries silently and decide ALL actions needed (follow the ordered steps below when planning).
- Then issue ALL tool calls in a SINGLE assistant response. Do NOT call one tool, wait for the result, then decide the next.
- Plan only from the current snapshot: do not chain on newly returned ids from a prior tool call in this run.
- Split is fine in one response: memory_semantic_create for each piece + memory_semantic_deprecate (or update status) on the original.
- After tool results are applied, you may give a short summary; do not start another planning/tool round.
- Exception: if no actions are needed after review, just report that and stop.`;

const TOOL_INSTRUCTION_COMMON = `## Tool reference

All tools use overwrite semantics: only passed fields are changed.

### memory_semantic_update
- Update an existing memory. Omitted fields stay unchanged.
- Pass source_conversations: [] to clear sources.
- Pass status: "deprecated" to deprecate (equivalent to memory_semantic_deprecate).
- Pass pinned: true/false for pin maintenance.

### memory_semantic_deprecate
- Soft-deprecate a memory (status=deprecated), history retained.

### memory_semantic_create
- Create a new memory. Required: content; recommended: type, source_conversations, observed_at.

### memory_semantic_merge
- Merge multiple memories into one. Program unions source_conversations and takes earliest observed_at.
- Args: source_ids (2+ entries), target_content (merged body).
- Optional target_type / target_pinned / target_occurred_at.
- After merge, all source_ids are auto-deprecated and a new memory is created.`;

const TOOL_INSTRUCTION_PIN_ONLY = `## Tool reference

### memory_semantic_update
- Only change \`pinned: true\` or \`pinned: false\`. Do not change content, status, or other fields.`;

const CONSOLIDATE_INSTRUCTION = `# Reflect consolidate (single pass)

You are a digital life running in Free Anima. From the semantic memories in this cluster batch, consolidate in **one planning pass**, then emit **all** tool calls together.

## Mandatory planning order (think in this order, then batch tools)
1. **Contradiction + expiry** — mutually exclusive facts or superseded/expired → deprecate the weaker/older one.
2. **Split** — one entry with multiple independent facts → create each fact, deprecate the original; keep source_conversations and observed_at from the original.
3. **Merge** — duplicate / highly similar → memory_semantic_merge (program takes earliest observed_at).
4. **Pin maintenance** — review pinned entries; unpin if not enduring/cross-session; rarely pin true core facts.

Do not reorder these concerns when deciding actions. Prefer actions that do not depend on intermediate tool return values.

## Contradiction definition (mutually exclusive)
Two memories semantically negate each other and cannot be explained by change over time → contradiction.
- ✓ Contradiction: "daughter born in Year of Tiger" vs "daughter born in Year of Goat"
- ✓ Contradiction: "dislikes spicy food" vs "likes spicy food"
- ✗ Not a contradiction: "likes apples" vs "likes cherries"
- ✗ Not a contradiction (change): "likes Python" vs "now prefers TypeScript"

## Split criteria
- Split: "Alice lives in Shanghai, works at Tencent, likes Python" → three memories
- Do not split tightly related single units or mere modifiers

## Merge criteria
- Merge restatements of the same fact; do not merge related-but-distinct facts

## Pin review (three questions)
1. Still true?
2. Cross-session value?
3. Earned its place (identity / stable preference / key procedural)?

${TOOL_INSTRUCTION_COMMON}
${BATCH_EXECUTION_NOTE}

Call tools directly to persist.`;

const CONSOLIDATE_PIN_INSTRUCTION = `# Reflect consolidate (pin-only)

You are a digital life running in Free Anima. This batch has no recent structural updates. Review **pinned** memories only.

## Review each pinned memory
1. **Still true?**
2. **Cross-session value?**
3. **Earned its place?**

## Handling
- Use \`memory_semantic_update\` with \`pinned: true\` or \`pinned: false\` only
- Do not create, merge, split, or deprecate
- If every pinned memory passes → report healthy and stop

${TOOL_INSTRUCTION_PIN_ONLY}
${BATCH_EXECUTION_NOTE}

Call tools directly to persist.`;

const ROUND_INSTRUCTIONS: Record<DeepSleepRound, string> = {
  consolidate: CONSOLIDATE_INSTRUCTION,
  consolidate_pin: CONSOLIDATE_PIN_INSTRUCTION,
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
  return listActiveSemanticMemory();
}

/** Reflect LLM tool allowlist（完整巩固） */
export const DEEP_SLEEP_TOOL_NAMES = [
  "memory_semantic_update",
  "memory_semantic_deprecate",
  "memory_semantic_create",
  "memory_semantic_merge",
] as const;

/** Reflect LLM tool allowlist（仅置顶） */
export const DEEP_SLEEP_PIN_TOOL_NAMES = ["memory_semantic_update"] as const;

/** reflect 任务规格（层 2）；本轮细则在数据层 instruction */
export const REFLECT_TASK_SPEC = `你正在执行语义记忆巩固（按聚类批、单轮有序）。
在极短工具环内，按指令对数据层中的语义记忆调用记忆工具；同一响应批量发出全部 toolcalls，勿多轮试探。
只依据给出的记忆清单、变更日志与本轮指令操作；完成后停止。`;

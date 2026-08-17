import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import { listActiveSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";

// ── semantic_memories：本批精简 JSON ──

/** Serialize each memory as compact JSON（仅巩固有用字段） */
export function rowToJsonCompact(row: SemanticMemoryRow): string {
  return JSON.stringify({
    id: row.id,
    type: row.type,
    content: row.content,
    source_conversations: row.source_conversations,
    observed: row.observed_at?.toISOString().slice(0, 19) ?? null,
    occurred: row.occurred_at ?? null,
  });
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

/** Recent-update window for incremental reflect (24h) */
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

/** 全局已 pin 条数是否超过上限（才跑 pin 精简） */
export function shouldTrimPinned(pinnedCount: number, pinnedMax: number): boolean {
  return pinnedCount > pinnedMax;
}

// ── task_spec（层 2）──

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
- Do **not** set pinned: true (automated reflect never adds pins).

### memory_semantic_deprecate
- Soft-deprecate a memory (status=deprecated), history retained.

### memory_semantic_create
- Create a new memory. Required: content; recommended: type, source_conversations, observed_at.
- Do **not** set pinned on create.

### memory_semantic_merge
- Merge multiple memories into one. Program unions source_conversations and takes earliest observed_at.
- Args: source_ids (2+ entries), target_content (merged body).
- Optional target_type / target_occurred_at. Do **not** set target_pinned: true.
- After merge, all source_ids are auto-deprecated and a new memory is created.`;

const TOOL_INSTRUCTION_PIN_TRIM = `## Tool reference

### memory_semantic_update
- Only pass \`pinned: false\` to unpin. Do not change content, status, or other fields.
- Never pass \`pinned: true\`.`;

/** 按簇批完整巩固（无 Pin 步骤；禁止加 pin） */
export const REFLECT_CONSOLIDATE_TASK_SPEC = `# Reflect consolidate (single pass)

You are a digital life running in Free Anima. From the semantic memories in this cluster batch, consolidate in **one planning pass**, then emit **all** tool calls together.

## Mandatory planning order (think in this order, then batch tools)
1. **Contradiction + expiry** — mutually exclusive facts or superseded/expired → deprecate the weaker/older one.
2. **Split** — one entry with multiple independent facts → create each fact, deprecate the original; keep source_conversations and observed_at from the original.
3. **Merge** — duplicate / highly similar → memory_semantic_merge (program takes earliest observed_at).

Do not reorder these concerns when deciding actions. Prefer actions that do not depend on intermediate tool return values.
Automated reflect must **not** add pins (\`pinned: true\` / \`target_pinned: true\`).

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

${TOOL_INSTRUCTION_COMMON}
${BATCH_EXECUTION_NOTE}

Call tools directly to persist.`;

/**
 * 全局 pin 超限精简：只 unpin。
 * task_params 提供 pinned_count / pinned_max（对应 {{pinned_count}} / {{pinned_max}}）。
 */
export const REFLECT_CONSOLIDATE_PIN_TASK_SPEC = `# Reflect pin trim (over limit)

You are a digital life running in Free Anima. Global pinned count is **{{pinned_count}}**, over the limit **{{pinned_max}}**.
The data layer lists currently pinned memories in this batch. Unpin until the store can fit within {{pinned_max}}.

## Review each pinned memory
1. **Still true?**
2. **Cross-session value?**
3. **Earned its place** (identity / stable preference / key procedural)?

## Handling
- Use \`memory_semantic_update\` with \`pinned: false\` only — never \`pinned: true\`
- Prefer unpinning weaker / redundant / low-enduring entries first
- Do not create, merge, split, or deprecate
- Aim so remaining pins ≤ {{pinned_max}} (across the whole store, not only this batch)
- If this batch alone cannot finish the trim, unpin as many weak entries as you can here

${TOOL_INSTRUCTION_PIN_TRIM}
${BATCH_EXECUTION_NOTE}

Call tools directly to persist.`;

/** @deprecated 使用 REFLECT_CONSOLIDATE_TASK_SPEC */
export const REFLECT_TASK_SPEC = REFLECT_CONSOLIDATE_TASK_SPEC;

/** Fetch all active memories needed for reflect */
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

/** Reflect LLM tool allowlist（仅 unpin） */
export const DEEP_SLEEP_PIN_TOOL_NAMES = ["memory_semantic_update"] as const;

/** Citation marker in body / replies: `[[anima:42]]` or `[[anima:42?component=semantic_memory]]` */
export const ANIMA_ENTITY_ID_PATTERN = "\\d+";

export const MEMORY_REFERENCE_MARKER_RE = new RegExp(
  `\\[\\[anima:(${ANIMA_ENTITY_ID_PATTERN})(?:\\?[^\\]]*)?\\]\\]`,
  "gi",
);

/** Citation marker: `[[anima:{id}]]` */
export function formatMemoryReferenceMarker(entityId: string | number): string {
  return `[[anima:${entityId}]]`;
}

/** Resident memory line with ID */
export function formatResidentMemoryLine(
  content: string,
  entityId: string | number,
  pinned: boolean,
): string {
  const marker = formatMemoryReferenceMarker(entityId);
  return pinned ? `- 📌 ${marker} ${content}` : `- ${marker} ${content}`;
}

/** Parse entity ids from `[[anima:…]]` markers (dedupe, preserve order) */
export function parseMemoryReferenceMarkers(content: string): number[] {
  if (!content.trim()) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const match of content.matchAll(MEMORY_REFERENCE_MARKER_RE)) {
    const raw = match[1];
    if (!raw) continue;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** System prompt rule: cite semantic memories used in assistant replies */
export const MEMORY_REFERENCE_CITATION_RULE =
  "When your reply uses semantic memory—whether from the resident or passive list (`<memory id>`), " +
  "`memory_semantic_search` results (`semantic_memory_id`), or prior message markers—" +
  "append each cited `[[anima:id]]` at the end of your reply. " +
  "Do not use this marker for conversation, limbic, or autobiographical search hits.";

/**
 * System prompt strategy: clarify / recall facts via semantic memory only
 * (resident → passive inject → active semantic search).
 */
export const MEMORY_RECALL_STRATEGY_RULE =
  "When clarifying references or recalling facts, prefer semantic memory in this order: " +
  "(1) resident memory already in the system prompt, " +
  "(2) this turn's passive semantic context (`passive_memory_context` assistant message), " +
  "(3) if still insufficient, call `memory_semantic_search`. " +
  "For emotion / autobiographical bricks use `content_block_search` with `component=limbic` or `component=narrative`; " +
  "do not treat conversation search as the default recall path.";

/** Short hint appended to recall/search tool descriptions */
export const MEMORY_SEMANTIC_CITATION_TOOL_HINT =
  "If your reply uses semantic memory results, append each cited `[[anima:{id}]]` (from `semantic_memory_id`) at the end of your reply.";

/** Weight multiplier for references within decay window (default; override via memory.reference) */
export const MEMORY_REFERENCE_RECENT_WEIGHT = 2;
/** Weight multiplier for references older than decay window */
export const MEMORY_REFERENCE_STALE_WEIGHT = 1;
/** Decay window in days (default; override via memory.reference.decay_days) */
export const MEMORY_REFERENCE_DECAY_DAYS = 30;

export type MemoryReferenceWeightOpts = {
  decayDays?: number;
  recentWeight?: number;
  staleWeight?: number;
};

export function memoryReferenceWeight(
  createdAt: Date,
  now = new Date(),
  opts?: MemoryReferenceWeightOpts,
): number {
  const decayDays = opts?.decayDays ?? MEMORY_REFERENCE_DECAY_DAYS;
  const recent = opts?.recentWeight ?? MEMORY_REFERENCE_RECENT_WEIGHT;
  const stale = opts?.staleWeight ?? MEMORY_REFERENCE_STALE_WEIGHT;
  const ageMs = now.getTime() - createdAt.getTime();
  const windowMs = decayDays * 24 * 60 * 60 * 1000;
  return ageMs <= windowMs ? recent : stale;
}

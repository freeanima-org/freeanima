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
  "When your reply uses semantic memory—whether from the resident memory list (inline `[[anima:id]]`), " +
  "`memory_recall` or `memory_semantic_search` results (`semantic_memory_id`), or prior message markers—" +
  "append each cited `[[anima:id]]` at the end of your reply. " +
  "Do not use this marker for conversation, limbic, or autobiographical recall hits.";

/** Short hint appended to recall/search tool descriptions */
export const MEMORY_SEMANTIC_CITATION_TOOL_HINT =
  "If your reply uses semantic memory results, append each cited `[[anima:{id}]]` (from `semantic_memory_id`) at the end of your reply.";

/** Weight multiplier for references within 30 days */
export const MEMORY_REFERENCE_RECENT_WEIGHT = 2;
/** Weight multiplier for references older than 30 days */
export const MEMORY_REFERENCE_STALE_WEIGHT = 1;
/** Decay window in days */
export const MEMORY_REFERENCE_DECAY_DAYS = 30;

export function memoryReferenceWeight(createdAt: Date, now = new Date()): number {
  const ageMs = now.getTime() - createdAt.getTime();
  const windowMs = MEMORY_REFERENCE_DECAY_DAYS * 24 * 60 * 60 * 1000;
  return ageMs <= windowMs ? MEMORY_REFERENCE_RECENT_WEIGHT : MEMORY_REFERENCE_STALE_WEIGHT;
}

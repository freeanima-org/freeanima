/** Semantic memory ID format: f-000001-abcd */
export const SEMANTIC_MEMORY_ID_PATTERN = "f-\\d{6}-[0-9a-f]{4}";

/** Citation marker in body / replies: `[[f-000001-abcd]]` */
export const MEMORY_REFERENCE_MARKER_RE = new RegExp(
  `\\[\\[(${SEMANTIC_MEMORY_ID_PATTERN})\\]\\]`,
  "gi",
);

/** Prefix injected for resident memory lines */
export function formatMemoryReferenceMarker(semanticMemoryId: string): string {
  return `[[${semanticMemoryId}]]`;
}

/** Resident memory line with ID */
export function formatResidentMemoryLine(
  content: string,
  semanticMemoryId: string,
  pinned: boolean,
): string {
  const marker = formatMemoryReferenceMarker(semanticMemoryId);
  return pinned ? `- 📌 ${marker} ${content}` : `- ${marker} ${content}`;
}

/** Parse semantic memory reference IDs from message body (dedupe, preserve order) */
export function parseMemoryReferenceMarkers(content: string): string[] {
  if (!content.trim()) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of content.matchAll(MEMORY_REFERENCE_MARKER_RE)) {
    const id = match[1]?.toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** System prompt rule: cite semantic memories used in assistant replies */
export const MEMORY_REFERENCE_CITATION_RULE =
  "When your reply uses semantic memory—whether from the resident memory list (inline `[[f-xxx]]`), " +
  "`memory_recall` or `memory_semantic_search` results (`semantic_memory_id`), or prior message markers—" +
  "append each cited `[[f-xxx]]` at the end of your reply. " +
  "Do not use this marker for session, limbic, or autobiographical recall hits.";

/** Short hint appended to recall/search tool descriptions */
export const MEMORY_SEMANTIC_CITATION_TOOL_HINT =
  "If your reply uses semantic memory results, append each cited `[[f-xxx]]` (from `semantic_memory_id`) at the end of your reply.";

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

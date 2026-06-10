/** Semantic memory ID format: f-000001-abcd */
export const SEMANTIC_MEMORY_ID_PATTERN = "f-\\d{6}-[0-9a-f]{4}";

/** Citation marker in body / replies: `[memory #f-000001-abcd]` */
export const MEMORY_REFERENCE_MARKER_RE = new RegExp(
  `\\[memory #(${SEMANTIC_MEMORY_ID_PATTERN})\\]`,
  "gi",
);

/** Prefix injected for resident memory lines */
export function formatMemoryReferenceMarker(semanticMemoryId: string): string {
  return `[memory #${semanticMemoryId}]`;
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

/** System prompt rule: LLM must cite referenced memories at the end of replies */
export const MEMORY_REFERENCE_CITATION_RULE =
  "If your reply references content carrying a `[memory #xxx]` marker, append the corresponding `[memory #xxx]` at the end of your reply.";

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

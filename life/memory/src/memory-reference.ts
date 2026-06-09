/** 语义记忆 ID 格式：f-000001-abcd */
export const SEMANTIC_MEMORY_ID_PATTERN = "f-\\d{6}-[0-9a-f]{4}";

/** 正文 / 回复中的引用标记：`[记忆 #f-000001-abcd]` */
export const MEMORY_REFERENCE_MARKER_RE = new RegExp(
  `\\[记忆 #(${SEMANTIC_MEMORY_ID_PATTERN})\\]`,
  "gi",
);

/** 常驻记忆注入前缀 */
export function formatMemoryReferenceMarker(semanticMemoryId: string): string {
  return `[记忆 #${semanticMemoryId}]`;
}

/** 带 ID 的常驻记忆行 */
export function formatResidentMemoryLine(
  content: string,
  semanticMemoryId: string,
  pinned: boolean,
): string {
  const marker = formatMemoryReferenceMarker(semanticMemoryId);
  return pinned ? `- 📌 ${marker} ${content}` : `- ${marker} ${content}`;
}

/** 从消息正文解析语义记忆引用 ID（去重、保序） */
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

/** system prompt 中要求 LLM 在回复末尾标注引用的记忆 */
export const MEMORY_REFERENCE_CITATION_RULE =
  "如果回复中参考了某条携带 `[记忆 #xxx]` 标记的内容，请在回复末尾标注对应的 `[记忆 #xxx]`。";

/** 30 天内引用权重倍数 */
export const MEMORY_REFERENCE_RECENT_WEIGHT = 2;
/** 30 天外引用权重倍数 */
export const MEMORY_REFERENCE_STALE_WEIGHT = 1;
/** 时间衰减窗口（天） */
export const MEMORY_REFERENCE_DECAY_DAYS = 30;

export function memoryReferenceWeight(createdAt: Date, now = new Date()): number {
  const ageMs = now.getTime() - createdAt.getTime();
  const windowMs = MEMORY_REFERENCE_DECAY_DAYS * 24 * 60 * 60 * 1000;
  return ageMs <= windowMs ? MEMORY_REFERENCE_RECENT_WEIGHT : MEMORY_REFERENCE_STALE_WEIGHT;
}

import type { AutobiographicalMemoryRow, SemanticMemoryRow } from "@freeanima/engine-repos";

function rowToJsonCompact(row: SemanticMemoryRow): string {
  return JSON.stringify({
    id: row.id,
    type: row.type,
    content: row.content,
    sources: row.source_sessions,
    observed: row.observed_at?.slice(0, 19) ?? null,
    occurred: row.occurred_at ?? null,
  });
}

export function formatCandidateSemanticMemories(rows: SemanticMemoryRow[]): string {
  if (!rows.length) {
    return "（无近期 experience/imprint 语义记忆）";
  }
  const lines = [`# 候选语义记忆（${rows.length} 条 experience/imprint）`];
  for (const row of rows) {
    lines.push(rowToJsonCompact(row));
  }
  return lines.join("\n");
}

export function formatExistingAutobiographical(rows: AutobiographicalMemoryRow[]): string {
  if (!rows.length) {
    return "（尚无自传体叙事）";
  }
  const lines = [`# 已有自传体叙事（${rows.length} 条 active）`];
  for (const row of rows) {
    lines.push(
      JSON.stringify({
        id: row.id,
        title: row.title,
        significance: row.significance,
        period_start: row.period_start,
        period_end: row.period_end,
        source_facts: row.source_facts,
        content_preview: row.content.slice(0, 200),
      }),
    );
  }
  return lines.join("\n");
}

export const AUTOBIOGRAPHY_INSTRUCTION = `# 自传体叙事提取

你从 **语义记忆（experience/imprint）** 中判断是否有「对我意味着什么」的叙事 worth 记录。

## 克制原则
- 没有值得记录的叙事 → **不要调用任何工具**，直接回复「本轮跳过：无值得记录的叙事」
- 不强行产出空条目、不重复已有叙事

## 工具
- create_autobiographical_memory：创建新叙事（只追加）
- deprecate_autobiographical_memory：仅当发现重复/明显过时时软废弃

## 要求
- 每条叙事需关联 source_facts（semantic_memory id）
- significance：turning_point（自我转折）> milestone（里程碑）> normal
- period_start/period_end 可填模糊时间（如「2026-05」）`;

export function buildAutobiographyUserMessages(
  candidates: SemanticMemoryRow[],
  existing: AutobiographicalMemoryRow[],
): [string, string] {
  return [
    `${formatCandidateSemanticMemories(candidates)}\n\n${formatExistingAutobiographical(existing)}`,
    AUTOBIOGRAPHY_INSTRUCTION,
  ];
}

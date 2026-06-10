import type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticMemoryRow,
  SessionStorePort,
} from "@freeanima/engine-repos";

import { getAutobiographicalMemoryStore } from "../autobiographical-port.ts";
import { getLimbicMemoryStore } from "../limbic-port.ts";
import { getSemanticMemoryStore } from "../semantic-port.ts";
import {
  collectLimbicMemoriesForSessions,
  collectSessionBlocks,
  formatDialogueMessage,
  formatLimbicMemoriesMessage,
} from "../light-sleep/build-messages.ts";

const AUTOBIOGRAPHY_SEMANTIC_TYPES = new Set(["experience", "imprint"]);

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

function sortSemanticForAutobiography(a: SemanticMemoryRow, b: SemanticMemoryRow): number {
  const aPriority = AUTOBIOGRAPHY_SEMANTIC_TYPES.has(a.type) ? 0 : 1;
  const bPriority = AUTOBIOGRAPHY_SEMANTIC_TYPES.has(b.type) ? 0 : 1;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return a.id.localeCompare(b.id);
}

export function formatSemanticMemoriesForAutobiography(rows: SemanticMemoryRow[]): string {
  if (!rows.length) {
    return "（本日无相关 semantic 记忆）";
  }
  const sorted = [...rows].toSorted(sortSemanticForAutobiography);
  const lines = [`# 本日相关语义记忆（${sorted.length} 条；experience/imprint 优先）`];
  for (const row of sorted) {
    lines.push(rowToJsonCompact(row));
  }
  return lines.join("\n");
}

export function formatLimbicMemoriesForAutobiography(rows: LimbicMemoryRow[]): string {
  if (!rows.length) {
    return "（本日无相关感性记忆）";
  }
  return formatLimbicMemoriesMessage(rows).replace("# 已有感性记忆", "# 本日感性记忆");
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
        source_semantic_memory: row.source_semantic_memory,
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
- memory_autobiographical_create：创建新叙事（只追加）
- memory_autobiographical_deprecate：仅当发现重复/明显过时时软废弃

## 要求
- 每条叙事需关联 source_semantic_memory（semantic_memory id）
- significance：turning_point（自我转折）> milestone（里程碑）> normal
- period_start/period_end 可填模糊时间（如「2026-05」）`;

export const LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION = `# 自传体叙事提取

综合上方「本日对话」「语义记忆」「感性记忆」判断是否有「对我意味着什么」的叙事 worth 记录。

## 克制原则
- 没有值得记录的叙事 → **不要调用任何工具**，直接回复「本轮跳过：无值得记录的叙事」
- 不强行产出空条目、不重复已有叙事

## 工具
- memory_autobiographical_create：创建新叙事（只追加）
- memory_autobiographical_deprecate：仅当发现重复/明显过时时软废弃

## 要求
- 优先从 experience/imprint 语义记忆与 turning_point/spike 类感性锚点提炼叙事
- 关联 source_semantic_memory / source_sessions 按需填写
- significance：turning_point（自我转折）> milestone（里程碑）> normal；强烈情感转折可提升 significance
- period_start/period_end 可填模糊时间（如「2026-05」）`;

async function mergeSemanticRowsForSessions(
  sessionIds: string[],
  stageSemanticIds: string[],
): Promise<SemanticMemoryRow[]> {
  const store = getSemanticMemoryStore();
  const byId = new Map<string, SemanticMemoryRow>();
  for (const row of await store.listBySourceSessions(sessionIds, { status: "active" })) {
    byId.set(row.id, row);
  }
  for (const id of stageSemanticIds) {
    if (byId.has(id)) continue;
    const row = await store.get(id);
    if (row && row.status === "active") {
      byId.set(id, row);
    }
  }
  return [...byId.values()];
}

async function mergeLimbicRowsForSessions(
  sessionIds: string[],
  stageLimbicIds: string[],
): Promise<LimbicMemoryRow[]> {
  const byId = new Map<string, LimbicMemoryRow>();
  for (const row of await collectLimbicMemoriesForSessions(sessionIds)) {
    byId.set(row.id, row);
  }
  const store = getLimbicMemoryStore();
  for (const id of stageLimbicIds) {
    if (byId.has(id)) continue;
    const row = await store.get(id);
    if (row) {
      byId.set(id, row);
    }
  }
  return [...byId.values()];
}

export function buildAutobiographyUserMessages(
  candidates: SemanticMemoryRow[],
  existing: AutobiographicalMemoryRow[],
): [string, string] {
  return [
    `${formatCandidateSemanticMemories(candidates)}\n\n${formatExistingAutobiographical(existing)}`,
    AUTOBIOGRAPHY_INSTRUCTION,
  ];
}

export async function buildLightSleepAutobiographyUserMessages(
  sessionStore: SessionStorePort,
  sessionIds: string[],
  stageSemanticIds: string[],
  stageLimbicIds: string[],
): Promise<string[]> {
  const blocks = await collectSessionBlocks(sessionStore, sessionIds);
  const dialogue = formatDialogueMessage(blocks);
  const semanticRows = await mergeSemanticRowsForSessions(sessionIds, stageSemanticIds);
  const limbicRows = await mergeLimbicRowsForSessions(sessionIds, stageLimbicIds);
  const existing = await getAutobiographicalMemoryStore().listActive({ limit: 200 });

  return [
    dialogue.text,
    formatSemanticMemoriesForAutobiography(semanticRows),
    formatLimbicMemoriesForAutobiography(limbicRows),
    formatExistingAutobiographical(existing),
    LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION,
  ];
}

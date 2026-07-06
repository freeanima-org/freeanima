import type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticMemoryRow,
} from "@freeanima/core/repos";
import { getLimbicMemory } from "@freeanima/core/db/pg/limbic-memory";
import {
  getSemanticMemory,
  listSemanticMemoryBySourceSessions,
} from "@freeanima/core/db/pg/semantic-memory";
import { listActiveAutobiographicalMemory } from "@freeanima/core/db/pg/autobiographical-memory";
import {
  collectLimbicMemoriesForSessions,
  collectConversationBlocks,
  formatDialogueMessage,
  formatLimbicMemoriesMessage,
} from "../light-sleep/build-messages.ts";

const AUTOBIOGRAPHY_SEMANTIC_TYPES = new Set(["experience", "imprint"]);

function rowToJsonCompact(row: SemanticMemoryRow): string {
  return JSON.stringify({
    id: row.id,
    type: row.type,
    content: row.content,
    sources: row.source_conversations,
    observed: row.observed_at?.toISOString().slice(0, 19) ?? null,
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
  if (rows.length === 0) {
    return "(No related semantic memories for this day)";
  }
  const sorted = [...rows].toSorted(sortSemanticForAutobiography);
  const lines = [
    `# Today's related semantic memories (${sorted.length} entries; experience/imprint first)`,
  ];
  for (const row of sorted) {
    lines.push(rowToJsonCompact(row));
  }
  return lines.join("\n");
}

export function formatLimbicMemoriesForAutobiography(rows: LimbicMemoryRow[]): string {
  if (rows.length === 0) {
    return "(No related limbic memories for this day)";
  }
  return formatLimbicMemoriesMessage(rows).replace(
    "# Existing limbic memories",
    "# Today's limbic memories",
  );
}

export function formatCandidateSemanticMemories(rows: SemanticMemoryRow[]): string {
  if (rows.length === 0) {
    return "(No recent experience/imprint semantic memories)";
  }
  const lines = [`# Candidate semantic memories (${rows.length} experience/imprint entries)`];
  for (const row of rows) {
    lines.push(rowToJsonCompact(row));
  }
  return lines.join("\n");
}

export function formatExistingAutobiographical(rows: AutobiographicalMemoryRow[]): string {
  if (rows.length === 0) {
    return "(No autobiographical narratives yet)";
  }
  const lines = [`# Existing autobiographical narratives (${rows.length} active entries)`];
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

export const AUTOBIOGRAPHY_INSTRUCTION = `# Autobiographical narrative extraction

From **semantic memories (experience/imprint)**, decide whether there is a narrative worth recording about "what this means to me".

## Restraint
- Nothing worth recording → **do not call any tool**; reply "Skipped this round: no narrative worth recording"
- Do not force empty entries or duplicate existing narratives

## Tools
- memory_autobiographical_create: create new narrative (append only)
- memory_autobiographical_deprecate: soft-deprecate only when duplicate or clearly outdated

## Requirements
- Each narrative must link source_semantic_memory (semantic_memory id)
- significance: turning_point (self turning point) > milestone > normal
- period_start/period_end may be fuzzy (e.g. "2026-05")`;

export const LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION = `# Autobiographical narrative extraction

Using "Today's dialogue", semantic memories, and limbic memories above, decide whether there is a narrative worth recording about "what this means to me".

## Restraint
- Nothing worth recording → **do not call any tool**; reply "Skipped this round: no narrative worth recording"
- Do not force empty entries or duplicate existing narratives

## Tools
- memory_autobiographical_create: create new narrative (append only)
- memory_autobiographical_deprecate: soft-deprecate only when duplicate or clearly outdated

## Requirements
- Prefer experience/imprint semantic memories and turning_point/spike limbic anchors
- Link source_semantic_memory / source_conversations as needed
- significance: turning_point (self turning point) > milestone > normal; strong emotional turns may raise significance
- period_start/period_end may be fuzzy (e.g. "2026-05")`;

async function mergeSemanticRowsForSessions(
  conversationIds: string[],
  stageSemanticIds: string[],
): Promise<SemanticMemoryRow[]> {
  const byId = new Map<string, SemanticMemoryRow>();
  for (const row of await listSemanticMemoryBySourceSessions(conversationIds, {
    status: "active",
  })) {
    byId.set(row.id, row);
  }
  for (const id of stageSemanticIds) {
    if (byId.has(id)) continue;
    const row = await getSemanticMemory(id);
    if (row && row.status === "active") {
      byId.set(id, row);
    }
  }
  return [...byId.values()];
}

async function mergeLimbicRowsForSessions(
  conversationIds: string[],
  stageLimbicIds: string[],
): Promise<LimbicMemoryRow[]> {
  const byId = new Map<string, LimbicMemoryRow>();
  for (const row of await collectLimbicMemoriesForSessions(conversationIds)) {
    byId.set(row.id, row);
  }
  for (const id of stageLimbicIds) {
    if (byId.has(id)) continue;
    const row = await getLimbicMemory(id);
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
  conversationIds: string[],
  stageSemanticIds: string[],
  stageLimbicIds: string[],
): Promise<string[]> {
  const blocks = await collectConversationBlocks(conversationIds);
  const dialogue = formatDialogueMessage(blocks);
  const semanticRows = await mergeSemanticRowsForSessions(conversationIds, stageSemanticIds);
  const limbicRows = await mergeLimbicRowsForSessions(conversationIds, stageLimbicIds);
  const existing = await listActiveAutobiographicalMemory({ limit: 200 });

  return [
    dialogue.text,
    formatSemanticMemoriesForAutobiography(semanticRows),
    formatLimbicMemoriesForAutobiography(limbicRows),
    formatExistingAutobiographical(existing),
    LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION,
  ];
}

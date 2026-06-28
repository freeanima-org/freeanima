import type { AutobiographicalMemoryRow } from "@freeanima/core/repos";
import {
  autobiographicalMemory,
  autobiographicalSignificanceSchema,
  autobiographicalStatusSchema,
  normalizePgTimestamp,
  type AutobiographicalSignificance,
  type AutobiographicalStatus,
} from "@freeanima/core/db/schema";

export type AutobiographicalMemoryDbRow = typeof autobiographicalMemory.$inferSelect;

function normalizeSignificance(raw: string | undefined | null): AutobiographicalSignificance {
  const parsed = autobiographicalSignificanceSchema.safeParse(String(raw ?? "normal").trim());
  return parsed.success ? parsed.data : "normal";
}

function normalizeStatus(raw: string | undefined | null): AutobiographicalStatus {
  const parsed = autobiographicalStatusSchema.safeParse(String(raw ?? "active").trim());
  return parsed.success ? parsed.data : "active";
}

export function mapAutobiographicalMemoryRow(
  row: AutobiographicalMemoryDbRow,
): AutobiographicalMemoryRow {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    significance: normalizeSignificance(row.significance),
    period_start: row.period_start ?? null,
    period_end: row.period_end ?? null,
    source_semantic_memory: row.source_facts ?? [],
    source_conversations: row.source_conversations ?? [],
    status: normalizeStatus(row.status),
    created: normalizePgTimestamp(row.created_at),
    updated: normalizePgTimestamp(row.updated_at),
  };
}

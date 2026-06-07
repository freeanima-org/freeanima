import type { AutobiographicalMemoryRow } from "@freeanima/engine-repos";
import {
  autobiographicalSignificanceSchema,
  autobiographicalStatusSchema,
  normalizePgTimestamp,
  type AutobiographicalSignificance,
  type AutobiographicalStatus,
} from "@freeanima/engine-db/schema";

export type AutobiographicalMemoryDbRow = {
  id: string;
  title: string;
  content: string;
  significance: string;
  period_start?: string | null;
  periodStart?: string | null;
  period_end?: string | null;
  periodEnd?: string | null;
  source_facts?: string[] | null;
  sourceFacts?: string[] | null;
  source_sessions?: string[] | null;
  sourceSessions?: string[] | null;
  status: string;
  created_at?: Date | string;
  createdAt?: Date | string;
  updated_at?: Date | string;
  updatedAt?: Date | string;
};

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
  const created = row.created_at ?? row.createdAt;
  const updated = row.updated_at ?? row.updatedAt;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    significance: normalizeSignificance(row.significance),
    period_start: row.period_start ?? row.periodStart ?? null,
    period_end: row.period_end ?? row.periodEnd ?? null,
    source_semantic_memory: row.source_facts ?? row.sourceFacts ?? [],
    source_sessions: row.source_sessions ?? row.sourceSessions ?? [],
    status: normalizeStatus(row.status),
    created: created != null ? normalizePgTimestamp(created) : "",
    updated: updated != null ? normalizePgTimestamp(updated) : "",
  };
}

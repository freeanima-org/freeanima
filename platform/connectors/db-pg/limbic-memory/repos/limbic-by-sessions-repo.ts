import { sql as drizzleSql } from "drizzle-orm";
import type { LimbicListBySessionsOpts, LimbicMemoryRow } from "@freeanima/core/repos";

import { getDb } from "../../client.ts";
import { mapLimbicMemoryRow, type LimbicMemoryDbRow } from "../mappers/limbic-mapper.ts";

export async function listLimbicMemoryBySessions(
  sessionIds: string[],
  opts?: LimbicListBySessionsOpts,
): Promise<LimbicMemoryRow[]> {
  const ids = sessionIds.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];

  const minIntensity = opts?.minIntensity ?? 0;
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const orderByIntensity = opts?.orderBy === "intensity_desc";

  const db = getDb();
  const rows = await db.execute<LimbicMemoryDbRow>(drizzleSql`
    SELECT
      id,
      session_id,
      kind,
      valence,
      arousal,
      content,
      intensity,
      source_segment,
      semantic_memory_ids,
      created_at
    FROM limbic_memory
    WHERE session_id = ANY(${ids}::text[])
      AND intensity > ${minIntensity}
    ORDER BY ${orderByIntensity ? drizzleSql`intensity DESC` : drizzleSql`created_at DESC`}
    LIMIT ${limit}
  `);
  return rows.map(mapLimbicMemoryRow);
}

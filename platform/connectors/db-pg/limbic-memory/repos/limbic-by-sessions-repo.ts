import { and, desc, gt, inArray } from "drizzle-orm";
import { limbicMemory } from "@freeanima/core/db/schema";
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
  const rows = await db
    .select()
    .from(limbicMemory)
    .where(and(inArray(limbicMemory.sessionId, ids), gt(limbicMemory.intensity, minIntensity)))
    .orderBy(orderByIntensity ? desc(limbicMemory.intensity) : desc(limbicMemory.createdAt))
    .limit(limit);

  return rows.map((row) => mapLimbicMemoryRow(row as LimbicMemoryDbRow));
}

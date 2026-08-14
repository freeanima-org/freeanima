import { and, inArray, isNull, sql as drizzleSql } from "drizzle-orm";

import { entities } from "@freeanima/habitat/core/db/schema";
import { getDb } from "@freeanima/habitat/core/db/pg/client";
import {
  memoryReferenceWeight,
  parseMemoryReferenceMarkers,
} from "@freeanima/habitat/core/db/pg/memory-reference/markers";
import { formatCstIso } from "@freeanima/habitat/core/util";

/**
 * syncTurn 内建 cite：只 bump entities.reference_count，不写 memory_references 边表。
 */
export async function bumpReferenceCountsFromTexts(
  texts: string[],
  opts?: { created_at?: Date },
): Promise<number[]> {
  const ids = [...new Set(texts.flatMap((t) => parseMemoryReferenceMarkers(t)))];
  if (ids.length === 0) return [];

  const db = getDb();
  const existing = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(inArray(entities.id, ids), isNull(entities.deleted_at)));
  const existingIds = existing.map((r) => r.id);
  if (existingIds.length === 0) return [];

  const created_at = opts?.created_at ?? new Date(formatCstIso());
  const weight = memoryReferenceWeight(created_at);
  const now = new Date(formatCstIso());
  await db
    .update(entities)
    .set({
      reference_count: drizzleSql`${entities.reference_count} + ${weight}`,
      updated_at: now,
    })
    .where(inArray(entities.id, existingIds));

  return existingIds;
}

import { and, desc, gt, sql } from "drizzle-orm";
import { limbicMemory } from "@freeanima/core/db/schema";
import type { LimbicListByCreatedOpts, LimbicMemoryRow } from "@freeanima/core/repos";

import { getDb } from "../../client.ts";
import { mapLimbicMemoryRow, type LimbicMemoryDbRow } from "../mappers/limbic-mapper.ts";

export async function listLimbicMemoryByCreatedBetween(
  fromIso: string,
  toIso: string,
  opts?: LimbicListByCreatedOpts,
): Promise<LimbicMemoryRow[]> {
  const from = fromIso.trim();
  const to = toIso.trim();
  if (!from || !to) return [];

  const minIntensity = opts?.minIntensity ?? 0;
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const orderByIntensity = opts?.orderBy === "intensity_desc";

  const db = getDb();
  const rows = await db
    .select()
    .from(limbicMemory)
    .where(
      and(
        sql`${limbicMemory.created_at} >= ${from}::timestamptz`,
        sql`${limbicMemory.created_at} < ${to}::timestamptz`,
        gt(limbicMemory.intensity, minIntensity),
      ),
    )
    .orderBy(orderByIntensity ? desc(limbicMemory.intensity) : desc(limbicMemory.created_at))
    .limit(limit);

  return rows.map((row) => mapLimbicMemoryRow(row as LimbicMemoryDbRow));
}

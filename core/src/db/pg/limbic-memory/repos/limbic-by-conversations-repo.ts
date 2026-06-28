import { and, desc, gt, inArray } from "drizzle-orm";
import { limbicMemory } from "@freeanima/core/db/schema";
import type { LimbicListByConversationsOpts, LimbicMemoryRow } from "../types.ts";

import { getDb } from "../../client.ts";

export async function listLimbicMemoryBySessions(
  conversationIds: string[],
  opts?: LimbicListByConversationsOpts,
): Promise<LimbicMemoryRow[]> {
  const ids = conversationIds.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];

  const minIntensity = opts?.minIntensity ?? 0;
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const orderByIntensity = opts?.orderBy === "intensity_desc";

  const db = getDb();
  const rows = await db
    .select()
    .from(limbicMemory)
    .where(
      and(inArray(limbicMemory.conversation_id, ids), gt(limbicMemory.intensity, minIntensity)),
    )
    .orderBy(orderByIntensity ? desc(limbicMemory.intensity) : desc(limbicMemory.created_at))
    .limit(limit);

  return rows.map((row) => row);
}

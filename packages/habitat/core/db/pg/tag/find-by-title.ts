import { and, eq, sql } from "drizzle-orm";

import { entities } from "@freeanima/habitat/core/db/schema";
import { TAG_COMPONENT } from "@freeanima/habitat/core/db/schema/entity";

/** 按 title 查找 tag entity id（忽略大小写） */
export async function findTagIdByTitle(worldId: number, title: string): Promise<number | null> {
  const normalized = title.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  const { getDb } = await import("../client.ts");
  const db = getDb();
  const [hit] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, worldId),
        eq(entities.primary_component, TAG_COMPONENT),
        sql`lower(${entities.title}) = ${lowered}`,
      ),
    )
    .limit(1);
  return hit?.id ?? null;
}

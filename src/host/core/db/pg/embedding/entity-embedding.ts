import { eq, sql } from "drizzle-orm";
import { entities } from "@freeanima/host/core/db/schema";

import { getDb } from "../client.ts";
import { formatPgVector } from "./format.ts";

export { scheduleEntityEmbedding } from "./schedule.ts";

export async function setEntityEmbedding(
  id: number,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(entities)
    .set({ search_embedding: sql`${formatPgVector(embedding)}::vector` })
    .where(eq(entities.id, id))
    .returning({ id: entities.id });
  return rows.length > 0;
}

export async function clearEntityEmbedding(id: number): Promise<void> {
  const db = getDb();
  await db.update(entities).set({ search_embedding: null }).where(eq(entities.id, id));
}

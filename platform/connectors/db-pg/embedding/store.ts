import { eq, sql } from "drizzle-orm";
import {
  autobiographicalMemory,
  limbicMemory,
  messages,
  semanticMemory,
} from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";
import { formatPgVector } from "./format.ts";

/** content kept for call-site symmetry; row is keyed by id only (avoids JS trim vs PG btrim mismatch). */
export async function setSemanticMemoryEmbedding(
  id: string,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(semanticMemory)
    .set({ content_embedding: sql`${formatPgVector(embedding)}::vector` })
    .where(eq(semanticMemory.id, id))
    .returning({ id: semanticMemory.id });
  return rows.length > 0;
}

export async function setMessageEmbedding(
  id: string,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(messages)
    .set({ content_embedding: sql`${formatPgVector(embedding)}::vector` })
    .where(eq(messages.id, id))
    .returning({ id: messages.id });
  return rows.length > 0;
}

export async function setLimbicMemoryEmbedding(
  id: string,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(limbicMemory)
    .set({ content_embedding: sql`${formatPgVector(embedding)}::vector` })
    .where(eq(limbicMemory.id, id))
    .returning({ id: limbicMemory.id });
  return rows.length > 0;
}

export async function setAutobiographicalMemoryEmbedding(
  id: string,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(autobiographicalMemory)
    .set({ content_embedding: sql`${formatPgVector(embedding)}::vector` })
    .where(eq(autobiographicalMemory.id, id))
    .returning({ id: autobiographicalMemory.id });
  return rows.length > 0;
}

export async function clearSemanticMemoryEmbedding(id: string): Promise<void> {
  const db = getDb();
  await db.update(semanticMemory).set({ content_embedding: null }).where(eq(semanticMemory.id, id));
}

export { setEntityEmbedding, clearEntityEmbedding } from "./entity-embedding.ts";

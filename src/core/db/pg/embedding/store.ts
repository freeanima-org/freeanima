import { eq, sql } from "drizzle-orm";
import { messages } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";
import { formatPgVector } from "./format.ts";
import { clearEntityEmbedding, setEntityEmbedding } from "./entity-embedding.ts";

/** content kept for call-site symmetry; row is keyed by id only (avoids JS trim vs PG btrim mismatch). */
export async function setSemanticMemoryEmbedding(
  id: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  return setEntityEmbedding(Number(id), content, embedding);
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
  content: string,
  embedding: number[],
): Promise<boolean> {
  return setEntityEmbedding(Number(id), content, embedding);
}

export async function setAutobiographicalMemoryEmbedding(
  id: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  return setEntityEmbedding(Number(id), content, embedding);
}

export async function clearSemanticMemoryEmbedding(id: string): Promise<void> {
  await clearEntityEmbedding(Number(id));
}

export { clearEntityEmbedding } from "./entity-embedding.ts";
export { setEntityEmbedding };

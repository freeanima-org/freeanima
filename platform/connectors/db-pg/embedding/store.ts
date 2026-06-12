import { sql as drizzleSql } from "drizzle-orm";

import { getDb } from "../client.ts";
import { formatPgVector } from "./format.ts";

/** content kept for call-site symmetry; row is keyed by id only (avoids JS trim vs PG btrim mismatch). */
export async function setSemanticMemoryEmbedding(
  id: string,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(drizzleSql`
    UPDATE semantic_memory
    SET content_embedding = ${formatPgVector(embedding)}::vector
    WHERE id = ${id}
    RETURNING id
  `);
  return rows.length > 0;
}

export async function setMessageEmbedding(
  id: string,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(drizzleSql`
    UPDATE messages
    SET content_embedding = ${formatPgVector(embedding)}::vector
    WHERE id = ${id}
    RETURNING id
  `);
  return rows.length > 0;
}

export async function clearSemanticMemoryEmbedding(id: string): Promise<void> {
  const db = getDb();
  await db.execute(drizzleSql`
    UPDATE semantic_memory SET content_embedding = NULL WHERE id = ${id}
  `);
}

import { sql as drizzleSql } from "drizzle-orm";

import { getDb } from "../client.ts";
import { formatPgVector } from "./format.ts";

export async function setSemanticMemoryEmbedding(
  id: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(drizzleSql`
    UPDATE semantic_memory
    SET content_embedding = ${formatPgVector(embedding)}::vector
    WHERE id = ${id}
      AND content = ${content}
    RETURNING id
  `);
  return rows.length > 0;
}

export async function setMessageEmbedding(
  id: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(drizzleSql`
    UPDATE messages
    SET content_embedding = ${formatPgVector(embedding)}::vector
    WHERE id = ${id}
      AND btrim(payload->>'content') = btrim(${content})
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

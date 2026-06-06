import { desc, eq, sql as drizzleSql } from "drizzle-orm";
import { normalizeSemanticMemoryType, semanticMemory } from "@freeanima/engine-db/schema";
import type { SemanticMemoryRow } from "@freeanima/engine-repos";
import { formatCstIso } from "@freeanima/kernel-util";

import { getDb } from "../../client.ts";
import { mapSemanticMemoryRow } from "../mappers/semantic-mapper.ts";
import { nextSemanticMemoryId } from "./id-gen.ts";

export async function createSemanticMemory(row: {
  content: string;
  type?: string;
  pinned?: boolean;
  id?: string;
  created?: string;
  updated?: string;
}): Promise<string> {
  const content = row.content.trim();
  if (!content) throw new Error("content is required");

  const id = row.id?.trim() || (await nextSemanticMemoryId());
  const type = normalizeSemanticMemoryType(row.type);
  const pinned = row.pinned ?? false;
  const now = formatCstIso();
  const created = row.created ?? now;
  const updated = row.updated ?? created;

  const db = getDb();
  await db
    .insert(semanticMemory)
    .values({
      id,
      type,
      pinned,
      content,
      created: new Date(created),
      updated: new Date(updated),
    })
    .onConflictDoUpdate({
      target: semanticMemory.id,
      set: {
        type,
        pinned,
        content,
        updated: new Date(updated),
      },
    });

  return id;
}

export async function getSemanticMemory(id: string): Promise<SemanticMemoryRow | null> {
  const db = getDb();
  const rows = await db.select().from(semanticMemory).where(eq(semanticMemory.id, id)).limit(1);
  const row = rows[0];
  return row ? mapSemanticMemoryRow(row) : null;
}

export async function updateSemanticMemory(row: {
  id: string;
  content?: string;
  type?: string;
  pinned?: boolean;
}): Promise<void> {
  const patch: Partial<typeof semanticMemory.$inferInsert> = {
    updated: new Date(formatCstIso()),
  };
  if (row.content !== undefined) patch.content = row.content.trim();
  if (row.type !== undefined) patch.type = normalizeSemanticMemoryType(row.type);
  if (row.pinned !== undefined) patch.pinned = row.pinned;

  const db = getDb();
  await db.update(semanticMemory).set(patch).where(eq(semanticMemory.id, row.id));
}

export async function deleteSemanticMemory(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db.delete(semanticMemory).where(eq(semanticMemory.id, id)).returning({
    id: semanticMemory.id,
  });
  return deleted.length > 0;
}

export async function countSemanticMemory(): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n FROM semantic_memory
  `);
  return Number(rows[0]?.n ?? 0);
}

export async function listResidentSemanticMemory(topN = 20): Promise<SemanticMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, topN));
  const db = getDb();
  const rows = await db
    .select()
    .from(semanticMemory)
    .orderBy(desc(semanticMemory.pinned), desc(semanticMemory.updated))
    .limit(limit);
  return rows.map(mapSemanticMemoryRow);
}

export async function listAllSemanticMemory(): Promise<SemanticMemoryRow[]> {
  const db = getDb();
  const rows = await db.select().from(semanticMemory).orderBy(desc(semanticMemory.updated));
  return rows.map(mapSemanticMemoryRow);
}

export async function findSemanticMemoryByContent(
  content: string,
): Promise<SemanticMemoryRow | null> {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const db = getDb();
  const rows = await db.execute<{
    id: string;
    type: string;
    pinned: boolean;
    content: string;
    created: Date;
    updated: Date;
  }>(drizzleSql`
    SELECT id, type, pinned, content, created, updated
    FROM semantic_memory
    WHERE btrim(content) = btrim(${trimmed})
    LIMIT 1
  `);
  const row = rows[0];
  return row ? mapSemanticMemoryRow(row) : null;
}

import { desc, eq } from "drizzle-orm";
import { limbicKindSchema, limbicMemory } from "@freeanima/core/db/schema";
import type { LimbicMemoryCreateInput, LimbicMemoryRow } from "@freeanima/core/repos";

import { scheduleLimbicMemoryEmbedding } from "../../embedding/schedule.ts";
import { resolveFtsSegmentedForWrite } from "../../fts/write.ts";
import { getDb } from "../../client.ts";

function normalizeKind(raw: string) {
  const parsed = limbicKindSchema.safeParse(String(raw).trim());
  if (!parsed.success) throw new Error(`invalid limbic kind: ${raw}`);
  return parsed.data;
}

function normalizeStringArray(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function clampUnit(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(-1, Math.min(1, value));
}

function clampNonNegativeUnit(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, value));
}

export async function createLimbicMemory(row: LimbicMemoryCreateInput): Promise<string> {
  const conversation_id = row.conversation_id.trim();
  const content = row.content.trim();
  if (!conversation_id) throw new Error("conversation_id is required");
  if (!content) throw new Error("content is required");

  const intensity = row.intensity ?? 0.5;
  if (intensity < 0 || intensity > 1) {
    throw new Error("intensity must be between 0 and 1");
  }

  const db = getDb();
  const fts_segmented = await resolveFtsSegmentedForWrite(content);
  const values: typeof limbicMemory.$inferInsert = {
    conversation_id,
    kind: normalizeKind(row.kind),
    content,
    fts_segmented,
    valence: clampUnit(row.valence),
    arousal: clampNonNegativeUnit(row.arousal),
    intensity,
    source_segment: row.source_segment ?? null,
    semantic_memory_ids: normalizeStringArray(row.semantic_memory_ids),
  };
  if (row.id?.trim()) values.id = row.id.trim();

  const rows = await db.insert(limbicMemory).values(values).returning({ id: limbicMemory.id });
  const id = rows[0]?.id;
  if (!id) throw new Error("failed to create limbic_memory");
  scheduleLimbicMemoryEmbedding(id, content);
  return id;
}

export async function getLimbicMemory(id: string): Promise<LimbicMemoryRow | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const db = getDb();
  const rows = await db.select().from(limbicMemory).where(eq(limbicMemory.id, trimmed)).limit(1);
  const row = rows[0];
  return row ? row : null;
}

export async function listLimbicMemoryBySession(
  conversation_id: string,
  opts?: { limit?: number },
): Promise<LimbicMemoryRow[]> {
  const sid = conversation_id.trim();
  if (!sid) return [];
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
  const db = getDb();
  const rows = await db
    .select()
    .from(limbicMemory)
    .where(eq(limbicMemory.conversation_id, sid))
    .orderBy(desc(limbicMemory.created_at))
    .limit(limit);
  return rows;
}

import { desc, eq } from "drizzle-orm";
import { limbicKindSchema, limbicMemory } from "@freeanima/engine-db/schema";
import type { LimbicMemoryCreateInput, LimbicMemoryRow } from "@freeanima/engine-repos";

import { getDb } from "../../client.ts";
import { mapLimbicMemoryRow } from "../mappers/limbic-mapper.ts";

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
  const sessionId = row.session_id.trim();
  const content = row.content.trim();
  if (!sessionId) throw new Error("session_id is required");
  if (!content) throw new Error("content is required");

  const intensity = row.intensity ?? 0.5;
  if (intensity < 0 || intensity > 1) {
    throw new Error("intensity must be between 0 and 1");
  }

  const db = getDb();
  const values: typeof limbicMemory.$inferInsert = {
    sessionId,
    kind: normalizeKind(row.kind),
    content,
    valence: clampUnit(row.valence),
    arousal: clampNonNegativeUnit(row.arousal),
    intensity,
    sourceSegment: row.source_segment ?? null,
    semanticMemoryIds: normalizeStringArray(row.semantic_memory_ids),
  };
  if (row.id?.trim()) values.id = row.id.trim();

  const rows = await db.insert(limbicMemory).values(values).returning({ id: limbicMemory.id });
  const id = rows[0]?.id;
  if (!id) throw new Error("failed to create limbic_memory");
  return id;
}

export async function getLimbicMemory(id: string): Promise<LimbicMemoryRow | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const db = getDb();
  const rows = await db.select().from(limbicMemory).where(eq(limbicMemory.id, trimmed)).limit(1);
  const row = rows[0];
  return row ? mapLimbicMemoryRow(row) : null;
}

export async function listLimbicMemoryBySession(
  sessionId: string,
  opts?: { limit?: number },
): Promise<LimbicMemoryRow[]> {
  const sid = sessionId.trim();
  if (!sid) return [];
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
  const db = getDb();
  const rows = await db
    .select()
    .from(limbicMemory)
    .where(eq(limbicMemory.sessionId, sid))
    .orderBy(desc(limbicMemory.createdAt))
    .limit(limit);
  return rows.map(mapLimbicMemoryRow);
}

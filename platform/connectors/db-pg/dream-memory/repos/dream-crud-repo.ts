import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { dreamEpisodicSnippetSchema, dreamMemory } from "@freeanima/core/db/schema";
import type { DreamMemoryCreateInput, DreamMemoryRow } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";
import { mapDreamMemoryRow } from "../mappers/dream-mapper.ts";

function normalizeStringArray(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function normalizeEpisodicSnippets(raw: DreamMemoryCreateInput["episodic_snippets"]) {
  if (!raw?.length) return [];
  const out = [];
  for (const item of raw) {
    const parsed = dreamEpisodicSnippetSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function createDreamMemory(row: DreamMemoryCreateInput): Promise<string> {
  const dream_day = row.dream_day.trim();
  const content = row.content.trim();
  if (!dream_day) throw new Error("dream_day is required");
  if (!content) throw new Error("content is required");

  const id = row.id?.trim() || randomUUID();
  const now = formatCstIso();
  const db = getDb();
  await db.insert(dreamMemory).values({
    id,
    dream_day,
    content,
    source_limbic_ids: normalizeStringArray(row.source_limbic_ids),
    source_conversation_ids: normalizeStringArray(row.source_conversation_ids),
    episodic_snippets: normalizeEpisodicSnippets(row.episodic_snippets),
    created_at: new Date(now),
  });
  return id;
}

export async function getDreamMemoryByDay(day: string): Promise<DreamMemoryRow | null> {
  const dream_day = day.trim();
  if (!dream_day) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(dreamMemory)
    .where(eq(dreamMemory.dream_day, dream_day))
    .limit(1);
  const row = rows[0];
  return row ? mapDreamMemoryRow(row) : null;
}

export async function getLatestDreamMemory(): Promise<DreamMemoryRow | null> {
  const db = getDb();
  const rows = await db.select().from(dreamMemory).orderBy(desc(dreamMemory.created_at)).limit(1);
  const row = rows[0];
  return row ? mapDreamMemoryRow(row) : null;
}

export async function listDreamMemory(opts?: {
  offset?: number;
  limit?: number;
}): Promise<DreamMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const offset = Math.max(0, opts?.offset ?? 0);
  const db = getDb();
  const rows = await db
    .select()
    .from(dreamMemory)
    .orderBy(desc(dreamMemory.created_at))
    .offset(offset)
    .limit(limit);
  return rows.map(mapDreamMemoryRow);
}

export async function countDreamMemory(): Promise<number> {
  const db = getDb();
  const rows = await db.select({ id: dreamMemory.id }).from(dreamMemory);
  return rows.length;
}

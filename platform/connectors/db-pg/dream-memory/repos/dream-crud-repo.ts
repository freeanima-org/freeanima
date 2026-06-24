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
  const dreamDay = row.dream_day.trim();
  const content = row.content.trim();
  if (!dreamDay) throw new Error("dream_day is required");
  if (!content) throw new Error("content is required");

  const id = row.id?.trim() || randomUUID();
  const now = formatCstIso();
  const db = getDb();
  await db.insert(dreamMemory).values({
    id,
    dreamDay,
    content,
    sourceLimbicIds: normalizeStringArray(row.source_limbic_ids),
    sourceConversationIds: normalizeStringArray(row.source_conversation_ids),
    episodicSnippets: normalizeEpisodicSnippets(row.episodic_snippets),
    createdAt: new Date(now),
  });
  return id;
}

export async function getDreamMemoryByDay(day: string): Promise<DreamMemoryRow | null> {
  const dreamDay = day.trim();
  if (!dreamDay) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(dreamMemory)
    .where(eq(dreamMemory.dreamDay, dreamDay))
    .limit(1);
  const row = rows[0];
  return row ? mapDreamMemoryRow(row) : null;
}

export async function getLatestDreamMemory(): Promise<DreamMemoryRow | null> {
  const db = getDb();
  const rows = await db.select().from(dreamMemory).orderBy(desc(dreamMemory.createdAt)).limit(1);
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
    .orderBy(desc(dreamMemory.createdAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapDreamMemoryRow);
}

export async function countDreamMemory(): Promise<number> {
  const db = getDb();
  const rows = await db.select({ id: dreamMemory.id }).from(dreamMemory);
  return rows.length;
}

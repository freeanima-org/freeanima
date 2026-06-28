import { randomUUID } from "node:crypto";

import { and, arrayOverlaps, asc, desc, eq, or, sql } from "drizzle-orm";
import {
  autobiographicalMemory,
  autobiographicalSignificanceSchema,
} from "@freeanima/core/db/schema";
import type {
  AutobiographicalListOpts,
  AutobiographicalMemoryCreateInput,
  AutobiographicalMemoryRow,
  AutobiographicalStatus,
} from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { scheduleAutobiographicalMemoryEmbedding } from "../../embedding/schedule.ts";
import { autobiographicalIndexText } from "../../fts/memory-index-text.ts";
import { resolveFtsSegmentedForWrite } from "../../fts/write.ts";
import { getDb } from "../../client.ts";
import { mapAutobiographicalMemoryRow } from "../mappers/autobiographical-mapper.ts";

const significanceOrderSql = sql`CASE ${autobiographicalMemory.significance}
  WHEN 'turning_point' THEN 1
  WHEN 'milestone' THEN 2
  ELSE 3
END`;

function normalizeSignificance(raw: string | undefined) {
  const parsed = autobiographicalSignificanceSchema.safeParse(String(raw ?? "normal").trim());
  return parsed.success ? parsed.data : "normal";
}

function normalizeStringArray(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeAutobiographicalListOpts(opts?: AutobiographicalListOpts) {
  const query = opts?.query?.trim() ?? "";
  const status = opts?.status ?? "active";
  const significanceRaw = opts?.significance;
  const significance =
    significanceRaw !== undefined
      ? autobiographicalSignificanceSchema.safeParse(String(significanceRaw).trim()).success
        ? autobiographicalSignificanceSchema.parse(String(significanceRaw).trim())
        : null
      : null;
  const sourceSession = opts?.source_conversation?.trim() ?? "";
  return { query, status, significance, sourceSession };
}

function buildAutobiographicalConditions(
  opts?: Omit<AutobiographicalListOpts, "offset" | "limit">,
) {
  const { query, status, significance, sourceSession } = normalizeAutobiographicalListOpts(opts);
  const conditions = [eq(autobiographicalMemory.status, status)];
  if (significance) {
    conditions.push(eq(autobiographicalMemory.significance, significance));
  }
  if (sourceSession) {
    conditions.push(arrayOverlaps(autobiographicalMemory.source_conversations, [sourceSession]));
  }
  if (query) {
    const pattern = `%${escapeIlikePattern(query)}%`;
    conditions.push(
      or(
        sql`${autobiographicalMemory.title} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${autobiographicalMemory.content} ILIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }
  return conditions;
}

export async function createAutobiographicalMemory(
  row: AutobiographicalMemoryCreateInput,
): Promise<string> {
  const title = row.title.trim();
  const content = row.content.trim();
  if (!title) throw new Error("title is required");
  if (!content) throw new Error("content is required");

  const id = row.id?.trim() || randomUUID();
  const now = formatCstIso();
  const indexText = autobiographicalIndexText(title, content);
  const fts_segmented = await resolveFtsSegmentedForWrite(indexText);
  const db = getDb();
  await db.insert(autobiographicalMemory).values({
    id,
    title,
    content,
    fts_segmented,
    significance: normalizeSignificance(row.significance),
    period_start: row.period_start ?? null,
    period_end: row.period_end ?? null,
    source_facts: normalizeStringArray(row.source_semantic_memory),
    source_conversations: normalizeStringArray(row.source_conversations),
    status: "active",
    created_at: new Date(now),
    updated_at: new Date(now),
  });
  scheduleAutobiographicalMemoryEmbedding(id, indexText);
  return id;
}

export async function getAutobiographicalMemory(
  id: string,
): Promise<AutobiographicalMemoryRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(autobiographicalMemory)
    .where(eq(autobiographicalMemory.id, id))
    .limit(1);
  const row = rows[0];
  return row ? mapAutobiographicalMemoryRow(row) : null;
}

export async function deprecateAutobiographicalMemory(id: string): Promise<boolean> {
  const trimmed = id.trim();
  if (!trimmed) return false;
  const now = formatCstIso();
  const db = getDb();
  const rows = await db
    .update(autobiographicalMemory)
    .set({
      status: "deprecated",
      updated_at: new Date(now),
    })
    .where(eq(autobiographicalMemory.id, trimmed))
    .returning({ id: autobiographicalMemory.id });
  return rows.length > 0;
}

export async function countAutobiographicalMemory(
  opts?: Omit<AutobiographicalListOpts, "offset" | "limit">,
): Promise<number> {
  const conditions = buildAutobiographicalConditions(opts);
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(autobiographicalMemory)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

export async function listActiveAutobiographicalMemory(opts?: {
  limit?: number;
  order?: "updated_desc" | "significance_desc";
}): Promise<AutobiographicalMemoryRow[]> {
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
  const order = opts?.order ?? "significance_desc";
  const db = getDb();

  if (order === "updated_desc") {
    const rows = await db
      .select()
      .from(autobiographicalMemory)
      .where(eq(autobiographicalMemory.status, "active"))
      .orderBy(desc(autobiographicalMemory.updated_at))
      .limit(limit);
    return rows.map(mapAutobiographicalMemoryRow);
  }

  const rows = await db
    .select()
    .from(autobiographicalMemory)
    .where(eq(autobiographicalMemory.status, "active"))
    .orderBy(asc(significanceOrderSql), desc(autobiographicalMemory.updated_at))
    .limit(limit);
  return rows.map(mapAutobiographicalMemoryRow);
}

export async function listAutobiographicalMemoryCreatedSince(
  iso: string,
  opts?: { limit?: number },
): Promise<AutobiographicalMemoryRow[]> {
  const since = iso.trim();
  if (!since) return [];
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
  const db = getDb();
  const rows = await db
    .select()
    .from(autobiographicalMemory)
    .where(
      and(
        eq(autobiographicalMemory.status, "active"),
        sql`${autobiographicalMemory.created_at} >= ${since}::timestamptz`,
      ),
    )
    .orderBy(desc(autobiographicalMemory.created_at))
    .limit(limit);
  return rows.map(mapAutobiographicalMemoryRow);
}

export async function listAutobiographicalMemoryBySourceSemanticMemory(
  semantic_memory_ids: string[],
  opts?: { status?: AutobiographicalStatus },
): Promise<AutobiographicalMemoryRow[]> {
  const ids = semantic_memory_ids.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];

  const status = opts?.status ?? "active";
  const conditions = [
    arrayOverlaps(autobiographicalMemory.source_facts, ids),
    eq(autobiographicalMemory.status, status),
  ];

  const db = getDb();
  const rows = await db
    .select()
    .from(autobiographicalMemory)
    .where(and(...conditions))
    .orderBy(desc(autobiographicalMemory.updated_at));
  return rows.map(mapAutobiographicalMemoryRow);
}

export async function listAutobiographicalMemoryBySourceSessions(
  conversationIds: string[],
  opts?: { status?: AutobiographicalStatus },
): Promise<AutobiographicalMemoryRow[]> {
  const ids = conversationIds.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];

  const status = opts?.status ?? "active";
  const conditions = [
    arrayOverlaps(autobiographicalMemory.source_conversations, ids),
    eq(autobiographicalMemory.status, status),
  ];

  const db = getDb();
  const rows = await db
    .select()
    .from(autobiographicalMemory)
    .where(and(...conditions))
    .orderBy(desc(autobiographicalMemory.updated_at));
  return rows.map(mapAutobiographicalMemoryRow);
}

export async function listAutobiographicalMemory(
  opts?: AutobiographicalListOpts,
): Promise<AutobiographicalMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const offset = Math.max(0, opts?.offset ?? 0);
  const conditions = buildAutobiographicalConditions(opts);

  const db = getDb();
  const rows = await db
    .select()
    .from(autobiographicalMemory)
    .where(and(...conditions))
    .orderBy(desc(autobiographicalMemory.updated_at))
    .offset(offset)
    .limit(limit);
  return rows.map(mapAutobiographicalMemoryRow);
}

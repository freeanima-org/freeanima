import { randomUUID } from "node:crypto";

import { desc, eq, sql as drizzleSql } from "drizzle-orm";
import {
  autobiographicalMemory,
  autobiographicalSignificanceSchema,
} from "@freeanima/storage-db/schema";
import type {
  AutobiographicalListOpts,
  AutobiographicalMemoryCreateInput,
  AutobiographicalMemoryRow,
  AutobiographicalStatus,
} from "@freeanima/storage-repos";
import { formatCstIso } from "@freeanima/storage-util";

import { getDb } from "../../client.ts";
import { pgTextArrayOverlap } from "../../utils/pg-sql.ts";
import {
  mapAutobiographicalMemoryRow,
  type AutobiographicalMemoryDbRow,
} from "../mappers/autobiographical-mapper.ts";

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
  const sourceSession = opts?.source_session?.trim() ?? "";
  return { query, status, significance, sourceSession };
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
  const db = getDb();
  await db.insert(autobiographicalMemory).values({
    id,
    title,
    content,
    significance: normalizeSignificance(row.significance),
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    sourceFacts: normalizeStringArray(row.source_semantic_memory),
    sourceSessions: normalizeStringArray(row.source_sessions),
    status: "active",
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
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
      updatedAt: new Date(now),
    })
    .where(eq(autobiographicalMemory.id, trimmed))
    .returning({ id: autobiographicalMemory.id });
  return rows.length > 0;
}

export async function countAutobiographicalMemory(
  opts?: Omit<AutobiographicalListOpts, "offset" | "limit">,
): Promise<number> {
  const { query, status, significance, sourceSession } = normalizeAutobiographicalListOpts(opts);

  const db = getDb();
  const significanceFilter = significance
    ? drizzleSql`AND significance = ${significance}`
    : drizzleSql``;
  const sourceFilter = sourceSession
    ? drizzleSql`AND ${pgTextArrayOverlap("source_sessions", [sourceSession])}`
    : drizzleSql``;
  const queryFilter = query
    ? drizzleSql`AND (title ILIKE ${"%" + escapeIlikePattern(query) + "%"} ESCAPE '\\' OR content ILIKE ${"%" + escapeIlikePattern(query) + "%"} ESCAPE '\\')`
    : drizzleSql``;

  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n
    FROM autobiographical_memory
    WHERE status = ${status}
    ${significanceFilter}
    ${sourceFilter}
    ${queryFilter}
  `);
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
      .orderBy(desc(autobiographicalMemory.updatedAt))
      .limit(limit);
    return rows.map(mapAutobiographicalMemoryRow);
  }

  const rows = await db.execute<AutobiographicalMemoryDbRow>(drizzleSql`
    SELECT
      id,
      title,
      content,
      significance,
      period_start,
      period_end,
      source_facts,
      source_sessions,
      status,
      created_at,
      updated_at
    FROM autobiographical_memory
    WHERE status = 'active'
    ORDER BY
      CASE significance
        WHEN 'turning_point' THEN 1
        WHEN 'milestone' THEN 2
        ELSE 3
      END,
      updated_at DESC
    LIMIT ${limit}
  `);
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
  const rows = await db.execute<AutobiographicalMemoryDbRow>(drizzleSql`
    SELECT
      id,
      title,
      content,
      significance,
      period_start,
      period_end,
      source_facts,
      source_sessions,
      status,
      created_at,
      updated_at
    FROM autobiographical_memory
    WHERE status = 'active'
      AND created_at >= ${since}::timestamptz
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return rows.map(mapAutobiographicalMemoryRow);
}

export async function listAutobiographicalMemoryBySourceSemanticMemory(
  semanticMemoryIds: string[],
  opts?: { status?: AutobiographicalStatus },
): Promise<AutobiographicalMemoryRow[]> {
  const ids = semanticMemoryIds.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];

  const status = opts?.status ?? "active";

  const db = getDb();
  const rows = await db.execute<AutobiographicalMemoryDbRow>(drizzleSql`
    SELECT
      id,
      title,
      content,
      significance,
      period_start,
      period_end,
      source_facts,
      source_sessions,
      status,
      created_at,
      updated_at
    FROM autobiographical_memory
    WHERE ${pgTextArrayOverlap("source_facts", ids)}
      AND status = ${status}
    ORDER BY updated_at DESC
  `);
  return rows.map(mapAutobiographicalMemoryRow);
}

export async function listAutobiographicalMemoryBySourceSessions(
  sessionIds: string[],
  opts?: { status?: AutobiographicalStatus },
): Promise<AutobiographicalMemoryRow[]> {
  const ids = sessionIds.map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];

  const status = opts?.status ?? "active";

  const db = getDb();
  const rows = await db.execute<AutobiographicalMemoryDbRow>(drizzleSql`
    SELECT
      id,
      title,
      content,
      significance,
      period_start,
      period_end,
      source_facts,
      source_sessions,
      status,
      created_at,
      updated_at
    FROM autobiographical_memory
    WHERE ${pgTextArrayOverlap("source_sessions", ids)}
      AND status = ${status}
    ORDER BY updated_at DESC
  `);
  return rows.map(mapAutobiographicalMemoryRow);
}

export async function listAutobiographicalMemory(
  opts?: AutobiographicalListOpts,
): Promise<AutobiographicalMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const offset = Math.max(0, opts?.offset ?? 0);
  const { query, status, significance, sourceSession } = normalizeAutobiographicalListOpts(opts);

  const db = getDb();
  const significanceFilter = significance
    ? drizzleSql`AND significance = ${significance}`
    : drizzleSql``;
  const sourceFilter = sourceSession
    ? drizzleSql`AND ${pgTextArrayOverlap("source_sessions", [sourceSession])}`
    : drizzleSql``;
  const queryFilter = query
    ? drizzleSql`AND (title ILIKE ${"%" + escapeIlikePattern(query) + "%"} ESCAPE '\\' OR content ILIKE ${"%" + escapeIlikePattern(query) + "%"} ESCAPE '\\')`
    : drizzleSql``;

  const rows = await db.execute<AutobiographicalMemoryDbRow>(drizzleSql`
    SELECT
      id,
      title,
      content,
      significance,
      period_start,
      period_end,
      source_facts,
      source_sessions,
      status,
      created_at,
      updated_at
    FROM autobiographical_memory
    WHERE status = ${status}
    ${significanceFilter}
    ${sourceFilter}
    ${queryFilter}
    ORDER BY updated_at DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `);
  return rows.map(mapAutobiographicalMemoryRow);
}

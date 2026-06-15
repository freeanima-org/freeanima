import { and, desc, eq, sql as drizzleSql, type SQL } from "drizzle-orm";
import { limbicKindSchema, limbicMemory } from "@freeanima/core/db/schema";
import type { LimbicListOpts, LimbicMemoryRow } from "@freeanima/core/repos";

import { getDb } from "../../client.ts";
import { mapLimbicMemoryRow } from "../mappers/limbic-mapper.ts";

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeListOpts(opts?: LimbicListOpts) {
  const query = opts?.query?.trim() ?? "";
  const sessionId = opts?.session_id?.trim() ?? "";
  const kindRaw = opts?.kind;
  const kind =
    kindRaw !== undefined
      ? limbicKindSchema.safeParse(String(kindRaw).trim()).success
        ? limbicKindSchema.parse(String(kindRaw).trim())
        : null
      : null;
  return { query, sessionId, kind };
}

function buildLimbicConditions(opts?: Omit<LimbicListOpts, "offset" | "limit">): SQL[] {
  const { query, sessionId, kind } = normalizeListOpts(opts);
  const conditions: SQL[] = [];
  if (sessionId) conditions.push(eq(limbicMemory.sessionId, sessionId));
  if (kind) conditions.push(eq(limbicMemory.kind, kind));
  if (query) {
    conditions.push(
      drizzleSql`${limbicMemory.content} ILIKE ${"%" + escapeIlikePattern(query) + "%"} ESCAPE '\\'`,
    );
  }
  return conditions;
}

export async function listLimbicMemory(opts?: LimbicListOpts): Promise<LimbicMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const offset = Math.max(0, opts?.offset ?? 0);
  const conditions = buildLimbicConditions(opts);

  const db = getDb();
  const rows = await db
    .select()
    .from(limbicMemory)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(limbicMemory.createdAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapLimbicMemoryRow);
}

export async function countLimbicMemory(
  opts?: Omit<LimbicListOpts, "offset" | "limit">,
): Promise<number> {
  const conditions = buildLimbicConditions(opts);
  const db = getDb();
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(limbicMemory)
    .where(conditions.length ? and(...conditions) : undefined);
  return Number(rows[0]?.n ?? 0);
}

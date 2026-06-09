import { sql as drizzleSql } from "drizzle-orm";
import { limbicKindSchema } from "@freeanima/engine-db/schema";
import type { LimbicListOpts, LimbicMemoryRow } from "@freeanima/engine-repos";

import { getDb } from "../../client.ts";
import { mapLimbicMemoryRow, type LimbicMemoryDbRow } from "../mappers/limbic-mapper.ts";

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

export async function listLimbicMemory(opts?: LimbicListOpts): Promise<LimbicMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20));
  const offset = Math.max(0, opts?.offset ?? 0);
  const { query, sessionId, kind } = normalizeListOpts(opts);

  const db = getDb();
  const sessionFilter = sessionId ? drizzleSql`AND session_id = ${sessionId}` : drizzleSql``;
  const kindFilter = kind ? drizzleSql`AND kind = ${kind}` : drizzleSql``;
  const queryFilter = query
    ? drizzleSql`AND content ILIKE ${"%" + escapeIlikePattern(query) + "%"} ESCAPE '\\'`
    : drizzleSql``;

  const rows = await db.execute<LimbicMemoryDbRow>(drizzleSql`
    SELECT
      id,
      session_id,
      kind,
      valence,
      arousal,
      content,
      intensity,
      source_segment,
      semantic_memory_ids,
      created_at
    FROM limbic_memory
    WHERE true
    ${sessionFilter}
    ${kindFilter}
    ${queryFilter}
    ORDER BY created_at DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `);
  return rows.map(mapLimbicMemoryRow);
}

export async function countLimbicMemory(
  opts?: Omit<LimbicListOpts, "offset" | "limit">,
): Promise<number> {
  const { query, sessionId, kind } = normalizeListOpts(opts);

  const db = getDb();
  const sessionFilter = sessionId ? drizzleSql`AND session_id = ${sessionId}` : drizzleSql``;
  const kindFilter = kind ? drizzleSql`AND kind = ${kind}` : drizzleSql``;
  const queryFilter = query
    ? drizzleSql`AND content ILIKE ${"%" + escapeIlikePattern(query) + "%"} ESCAPE '\\'`
    : drizzleSql``;

  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n
    FROM limbic_memory
    WHERE true
    ${sessionFilter}
    ${kindFilter}
    ${queryFilter}
  `);
  return Number(rows[0]?.n ?? 0);
}

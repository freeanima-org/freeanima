import { and, desc, eq, sql as drizzleSql, type SQL } from "drizzle-orm";
import { limbicKindSchema, limbicMemory } from "@freeanima/core/db/schema";
import type { LimbicListOpts, LimbicMemoryRow } from "@freeanima/core/repos";

import { getDb } from "../../client.ts";

function normalizeListOpts(opts?: LimbicListOpts) {
  const query = opts?.query?.trim() ?? "";
  const conversation_id = opts?.conversation_id?.trim() ?? "";
  const kindRaw = opts?.kind;
  const kind =
    kindRaw !== undefined
      ? limbicKindSchema.safeParse(String(kindRaw).trim()).success
        ? limbicKindSchema.parse(String(kindRaw).trim())
        : null
      : null;
  return { query, conversation_id, kind };
}

function buildLimbicConditions(opts?: Omit<LimbicListOpts, "offset" | "limit">): SQL[] {
  const { query, conversation_id, kind } = normalizeListOpts(opts);
  const conditions: SQL[] = [];
  if (conversation_id) conditions.push(eq(limbicMemory.conversation_id, conversation_id));
  if (kind) conditions.push(eq(limbicMemory.kind, kind));
  if (query) {
    conditions.push(drizzleSql`strpos(lower(${limbicMemory.content}), lower(${query})) > 0`);
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
    .orderBy(desc(limbicMemory.created_at))
    .offset(offset)
    .limit(limit);
  return rows;
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

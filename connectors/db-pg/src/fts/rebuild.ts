import { sql as drizzleSql } from "drizzle-orm";

import { isCjkJiebaEnabled } from "@freeanima/service-config";

import { getDb } from "../client.ts";
import { segmentForFts } from "./segment.ts";

const BATCH_SIZE = 500;

export type FtsRebuildResult = {
  tables: Record<string, number>;
  cjk_enabled: boolean;
};

async function rebuildSemanticMemoryFtsSegmented(useJieba: boolean): Promise<number> {
  const db = getDb();
  let updated = 0;
  let offset = 0;

  for (;;) {
    const rows = await db.execute<{ id: string; content: string }>(drizzleSql`
      SELECT id, content
      FROM semantic_memory
      ORDER BY id
      OFFSET ${offset}
      LIMIT ${BATCH_SIZE}
    `);
    if (!rows.length) break;

    for (const row of rows) {
      const ftsSegmented = useJieba ? await segmentForFts(row.content) : null;
      await db.execute(drizzleSql`
        UPDATE semantic_memory
        SET fts_segmented = ${ftsSegmented}
        WHERE id = ${row.id}
      `);
      updated += 1;
    }
    offset += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }

  return updated;
}

async function rebuildMessagesFtsSegmented(useJieba: boolean): Promise<number> {
  const db = getDb();
  let updated = 0;
  let offset = 0;

  for (;;) {
    const rows = await db.execute<{ id: string; content: string | null }>(drizzleSql`
      SELECT id, payload->>'content' AS content
      FROM messages
      WHERE content_fts IS NOT NULL
      ORDER BY id
      OFFSET ${offset}
      LIMIT ${BATCH_SIZE}
    `);
    if (!rows.length) break;

    for (const row of rows) {
      const content = row.content ?? "";
      const ftsSegmented = useJieba && content ? await segmentForFts(content) : null;
      await db.execute(drizzleSql`
        UPDATE messages
        SET fts_segmented = ${ftsSegmented}
        WHERE id = ${row.id}
      `);
      updated += 1;
    }
    offset += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }

  return updated;
}

/** 按当前 cjk.enabled 全量刷新 fts_segmented */
export async function rebuildAllFtsSegments(): Promise<FtsRebuildResult> {
  const useJieba = isCjkJiebaEnabled();
  const semantic_memory = await rebuildSemanticMemoryFtsSegmented(useJieba);
  const messages = await rebuildMessagesFtsSegmented(useJieba);
  return {
    tables: { semantic_memory, messages },
    cjk_enabled: useJieba,
  };
}

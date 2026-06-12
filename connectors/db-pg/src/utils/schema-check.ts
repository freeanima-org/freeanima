import { sql as drizzleSql } from "drizzle-orm";

import type { Db } from "../client.ts";

/** Verify messages: PK=id(TEXT), pos column, payload JSONB, unique (session_id, pos) */
export async function assertMessagesSchema(db: Db): Promise<void> {
  const pkRows = await db.execute<{ cols: string[] | null }>(drizzleSql`
    SELECT array_agg(a.attname ORDER BY k.ord) AS cols
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE i.indrelid = 'public.messages'::regclass AND i.indisprimary
  `);
  const pkCols = pkRows[0]?.cols ?? [];
  if (pkCols.length !== 1 || pkCols[0] !== "id") {
    throw new Error(
      `messages table PK should be (id), currently (${pkCols.join(", ") || "unknown"}).` +
        "Run: bun run --filter @freeanima/storage-db db:migrate",
    );
  }

  const posCol = await db.execute<{ exists: boolean }>(drizzleSql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'pos'
    ) AS exists
  `);
  if (!posCol[0]?.exists) {
    throw new Error(
      "messages table missing pos column (in-session sequence). Run: bun run --filter @freeanima/storage-db db:migrate",
    );
  }

  const payloadCol = await db.execute<{ exists: boolean }>(drizzleSql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'payload'
    ) AS exists
  `);
  if (!payloadCol[0]?.exists) {
    throw new Error(
      "messages table missing payload column. Run: bun run --filter @freeanima/storage-db db:migrate",
    );
  }

  const uqRows = await db.execute<{ cnt: number }>(drizzleSql`
    SELECT count(*)::int AS cnt
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%session_id%'
      AND indexdef LIKE '%pos%'
  `);
  if (Number(uqRows[0]?.cnt ?? 0) < 1) {
    throw new Error(
      "messages table missing unique index on (session_id, pos). Run: bun run --filter @freeanima/storage-db db:migrate",
    );
  }
}

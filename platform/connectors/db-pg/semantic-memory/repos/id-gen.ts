import { randomBytes } from "node:crypto";
import { sql as drizzleSql } from "drizzle-orm";

import { getDb } from "../../client.ts";

const ID_RE = /^f-(\d{6})-[0-9a-f]{4}$/;

function parseSeqFromId(id: string): number | null {
  const m = ID_RE.exec(id);
  return m ? parseInt(m[1]!, 10) : null;
}

export function formatSemanticMemoryId(seq: number): string {
  const rand = randomBytes(2).toString("hex");
  return `f-${String(seq).padStart(6, "0")}-${rand}`;
}

export async function nextSemanticMemoryId(): Promise<string> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(drizzleSql`
    SELECT id
    FROM semantic_memory
    WHERE id ~ '^f-[0-9]{6}-[0-9a-f]{4}$'
    ORDER BY id DESC
    LIMIT 1
  `);
  const lastSeq = rows[0]?.id ? (parseSeqFromId(rows[0].id) ?? 0) : 0;
  return formatSemanticMemoryId(lastSeq + 1);
}

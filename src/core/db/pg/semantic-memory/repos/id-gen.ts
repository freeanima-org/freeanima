import { randomBytes } from "node:crypto";
import { desc, sql } from "drizzle-orm";
import { semanticMemory } from "@freeanima/core/db/schema";

import { getDb } from "../../client.ts";

const ID_RE = /^f-(\d{6})-[0-9a-f]{4}$/;

function parseSeqFromId(id: string): number | null {
  const m = ID_RE.exec(id);
  if (m === null) return null;
  const seqGroup = m[1];
  return seqGroup === undefined ? null : parseInt(seqGroup, 10);
}

export function formatSemanticMemoryId(seq: number): string {
  const rand = randomBytes(2).toString("hex");
  return `f-${String(seq).padStart(6, "0")}-${rand}`;
}

export async function nextSemanticMemoryId(): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ id: semanticMemory.id })
    .from(semanticMemory)
    .where(sql`${semanticMemory.id} ~ '^f-[0-9]{6}-[0-9a-f]{4}$'`)
    .orderBy(desc(semanticMemory.id))
    .limit(1);
  const lastSeq = rows[0]?.id ? (parseSeqFromId(rows[0].id) ?? 0) : 0;
  return formatSemanticMemoryId(lastSeq + 1);
}

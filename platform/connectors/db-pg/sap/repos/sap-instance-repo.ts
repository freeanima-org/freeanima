import { eq } from "drizzle-orm";
import { sapInstances } from "@freeanima/core/db/schema";
import type { SapInstanceRow, SapInstanceUpsertInput } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";

function mapRow(row: typeof sapInstances.$inferSelect): SapInstanceRow {
  return {
    instanceId: row.instanceId,
    appId: row.appId,
    httpUrl: row.httpUrl,
    createdAt: row.createdAt,
  };
}

export async function getSapInstance(instanceId: string): Promise<SapInstanceRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(sapInstances)
    .where(eq(sapInstances.instanceId, instanceId))
    .limit(1);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function upsertSapInstance(input: SapInstanceUpsertInput): Promise<void> {
  const db = getDb();
  const createdAt = input.createdAt ?? formatCstIso();
  await db
    .insert(sapInstances)
    .values({
      instanceId: input.instanceId,
      appId: input.appId,
      httpUrl: input.httpUrl ?? null,
      createdAt,
    })
    .onConflictDoUpdate({
      target: sapInstances.instanceId,
      set: {
        appId: input.appId,
        httpUrl: input.httpUrl ?? null,
      },
    });
}

export async function listAllSapInstances(): Promise<SapInstanceRow[]> {
  const db = getDb();
  const rows = await db.select().from(sapInstances);
  return rows.map(mapRow);
}

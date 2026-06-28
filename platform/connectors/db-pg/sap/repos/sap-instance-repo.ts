import { eq } from "drizzle-orm";
import { sapInstances } from "@freeanima/core/db/schema";
import type { SapInstanceRow, SapInstanceUpsertInput } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";

function mapRow(row: typeof sapInstances.$inferSelect): SapInstanceRow {
  return {
    instance_id: row.instance_id,
    app_id: row.app_id,
    http_url: row.http_url,
    created_at: row.created_at,
  };
}

export async function getSapInstance(instance_id: string): Promise<SapInstanceRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(sapInstances)
    .where(eq(sapInstances.instance_id, instance_id))
    .limit(1);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function upsertSapInstance(input: SapInstanceUpsertInput): Promise<void> {
  const db = getDb();
  const created_at = input.created_at ?? formatCstIso();
  await db
    .insert(sapInstances)
    .values({
      instance_id: input.instance_id,
      app_id: input.app_id,
      http_url: input.http_url ?? null,
      created_at,
    })
    .onConflictDoUpdate({
      target: sapInstances.instance_id,
      set: {
        app_id: input.app_id,
        http_url: input.http_url ?? null,
      },
    });
}

export async function listAllSapInstances(): Promise<SapInstanceRow[]> {
  const db = getDb();
  const rows = await db.select().from(sapInstances);
  return rows.map(mapRow);
}

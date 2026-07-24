import { eq } from "drizzle-orm";
import { outpostInstances } from "@freeanima/host/core/db/schema";
import type { OutpostInstanceRow, OutpostInstanceUpsertInput } from "../types.ts";

import { getDb } from "../../client.ts";

export async function getRemoteToolInstance(
  instance_id: string,
): Promise<OutpostInstanceRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(outpostInstances)
    .where(eq(outpostInstances.instance_id, instance_id))
    .limit(1);
  const row = rows[0];
  return row ? row : null;
}

export async function upsertRemoteToolInstance(input: OutpostInstanceUpsertInput): Promise<void> {
  const db = getDb();
  const created_at = input.created_at ? new Date(input.created_at) : new Date();
  await db
    .insert(outpostInstances)
    .values({
      instance_id: input.instance_id,
      app_id: input.app_id,
      http_url: input.http_url ?? null,
      created_at,
    })
    .onConflictDoUpdate({
      target: outpostInstances.instance_id,
      set: {
        app_id: input.app_id,
        http_url: input.http_url ?? null,
      },
    });
}

export async function listAllOutpostInstances(): Promise<OutpostInstanceRow[]> {
  const db = getDb();
  const rows = await db.select().from(outpostInstances);
  return rows.map((row) => row);
}

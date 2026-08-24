import { asc, eq } from "drizzle-orm";

import { habitatTrustedSatellites } from "@freeanima/habitat/core/db/schema/federation.ts";
import { getDb } from "../../client.ts";
import type { TrustedSatelliteCreateInput, TrustedSatelliteRow } from "../types.ts";

export async function listTrustedSatellites(): Promise<TrustedSatelliteRow[]> {
  const db = getDb();
  return db
    .select()
    .from(habitatTrustedSatellites)
    .orderBy(asc(habitatTrustedSatellites.created_at));
}

export async function getTrustedSatellite(
  satellite_habitat_instance_id: string,
): Promise<TrustedSatelliteRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(habitatTrustedSatellites)
    .where(
      eq(habitatTrustedSatellites.satellite_habitat_instance_id, satellite_habitat_instance_id),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Satellite 出站握手：写入或刷新 pending（单向授信请求） */
export async function upsertPendingSatellite(input: {
  satellite_habitat_instance_id: string;
  satellite_public_key: string;
}): Promise<TrustedSatelliteRow> {
  const db = getDb();
  const now = new Date();
  const existing = await getTrustedSatellite(input.satellite_habitat_instance_id);
  if (existing?.status === "trusted") {
    if (existing.satellite_public_key !== input.satellite_public_key) {
      throw new Error("public key mismatch for trusted satellite");
    }
    return existing;
  }

  if (existing) {
    const rows = await db
      .update(habitatTrustedSatellites)
      .set({
        satellite_public_key: input.satellite_public_key,
        status: "pending",
        trusted_at: null,
        revoked_at: null,
      })
      .where(
        eq(
          habitatTrustedSatellites.satellite_habitat_instance_id,
          input.satellite_habitat_instance_id,
        ),
      )
      .returning();
    const row = rows[0];
    if (!row) throw new Error("upsertPendingSatellite: update returned no row");
    return row;
  }

  const rows = await db
    .insert(habitatTrustedSatellites)
    .values({
      satellite_habitat_instance_id: input.satellite_habitat_instance_id,
      satellite_public_key: input.satellite_public_key,
      label: null,
      status: "pending",
      linked_contact_id: null,
      created_at: now,
      trusted_at: null,
      revoked_at: null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("upsertPendingSatellite: insert returned no row");
  return row;
}

export async function createTrustedSatellite(
  input: TrustedSatelliteCreateInput,
): Promise<TrustedSatelliteRow> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .insert(habitatTrustedSatellites)
    .values({
      satellite_habitat_instance_id: input.satellite_habitat_instance_id,
      satellite_public_key: input.satellite_public_key,
      label: input.label ?? null,
      status: "trusted",
      linked_contact_id: input.linked_contact_id ?? null,
      created_at: now,
      trusted_at: now,
      revoked_at: null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("createTrustedSatellite: insert returned no row");
  return row;
}

export async function approveTrustedSatellite(
  satellite_habitat_instance_id: string,
  patch?: { label?: string | null; linked_contact_id?: number | null },
): Promise<TrustedSatelliteRow | null> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .update(habitatTrustedSatellites)
    .set({
      status: "trusted",
      trusted_at: now,
      revoked_at: null,
      ...(patch?.label !== undefined ? { label: patch.label } : {}),
      ...(patch?.linked_contact_id !== undefined
        ? { linked_contact_id: patch.linked_contact_id }
        : {}),
    })
    .where(
      eq(habitatTrustedSatellites.satellite_habitat_instance_id, satellite_habitat_instance_id),
    )
    .returning();
  const row = rows[0];
  if (!row || row.status !== "trusted") return null;
  return row;
}

export async function rejectPendingSatellite(
  satellite_habitat_instance_id: string,
): Promise<TrustedSatelliteRow | null> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .update(habitatTrustedSatellites)
    .set({ status: "revoked", revoked_at: now })
    .where(
      eq(habitatTrustedSatellites.satellite_habitat_instance_id, satellite_habitat_instance_id),
    )
    .returning();
  return rows[0] ?? null;
}

export async function revokeTrustedSatellite(
  satellite_habitat_instance_id: string,
): Promise<TrustedSatelliteRow | null> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .update(habitatTrustedSatellites)
    .set({ status: "revoked", revoked_at: now })
    .where(
      eq(habitatTrustedSatellites.satellite_habitat_instance_id, satellite_habitat_instance_id),
    )
    .returning();
  return rows[0] ?? null;
}

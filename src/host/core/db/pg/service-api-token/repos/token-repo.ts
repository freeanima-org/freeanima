import { and, eq, isNull, sql } from "drizzle-orm";
import { serviceApiTokens } from "@freeanima/host/core/db/schema";

import { getDb } from "../../client.ts";
import type { CreateServiceApiTokenInput } from "../types.ts";
import { toServiceApiTokenPublic } from "../types.ts";

export async function countServiceApiTokens(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceApiTokens)
    .where(isNull(serviceApiTokens.revoked_at));
  return rows[0]?.count ?? 0;
}

export async function getServiceApiTokenByPrefix(prefix: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceApiTokens)
    .where(eq(serviceApiTokens.prefix, prefix))
    .limit(1);
  return rows[0] ?? null;
}

export async function getServiceApiTokenById(id: number) {
  const db = getDb();
  const rows = await db.select().from(serviceApiTokens).where(eq(serviceApiTokens.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listServiceApiTokensBySubject(subject_id: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceApiTokens)
    .where(eq(serviceApiTokens.subject_id, subject_id))
    .orderBy(sql`${serviceApiTokens.created_at} DESC`);
  return rows.map((row) => toServiceApiTokenPublic(row));
}

export async function createServiceApiToken(input: CreateServiceApiTokenInput) {
  const db = getDb();
  const rows = await db
    .insert(serviceApiTokens)
    .values({
      subject_id: input.subject_id,
      name: input.name,
      prefix: input.prefix,
      token_hash: input.token_hash,
      token_secret: input.token_secret ?? null,
      scopes: input.scopes ?? ["full"],
      created_at: new Date(),
      expires_at: input.expires_at ?? null,
      last_used_at: null,
      revoked_at: null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("failed to create service api token");
  return toServiceApiTokenPublic(row);
}

export async function updateServiceApiTokenName(id: number, name: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(serviceApiTokens)
    .set({ name })
    .where(eq(serviceApiTokens.id, id))
    .returning({ id: serviceApiTokens.id });
  return rows.length > 0;
}

export async function revokeServiceApiToken(id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(serviceApiTokens)
    .set({ revoked_at: new Date() })
    .where(and(eq(serviceApiTokens.id, id), isNull(serviceApiTokens.revoked_at)))
    .returning({ id: serviceApiTokens.id });
  return rows.length > 0;
}

export async function touchServiceApiTokenLastUsed(id: number): Promise<void> {
  const db = getDb();
  await db
    .update(serviceApiTokens)
    .set({ last_used_at: new Date() })
    .where(eq(serviceApiTokens.id, id));
}

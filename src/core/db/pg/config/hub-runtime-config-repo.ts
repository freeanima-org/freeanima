import { eq } from "drizzle-orm";

import { HUB_RUNTIME_CONFIG_ID, hubRuntimeConfig } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";

function mergeSection(
  document: Record<string, unknown>,
  section: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const existing =
    typeof document[section] === "object" &&
    document[section] != null &&
    !Array.isArray(document[section])
      ? (document[section] as Record<string, unknown>)
      : {};
  return {
    ...document,
    [section]: { ...existing, ...patch },
  };
}

export async function getHubRuntimeConfigDocument(): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db
    .select({ document: hubRuntimeConfig.document })
    .from(hubRuntimeConfig)
    .where(eq(hubRuntimeConfig.id, HUB_RUNTIME_CONFIG_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return {};
  return row.document ?? {};
}

export async function upsertHubRuntimeConfigDocument(
  document: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(hubRuntimeConfig)
    .values({
      id: HUB_RUNTIME_CONFIG_ID,
      document,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: hubRuntimeConfig.id,
      set: {
        document,
        updated_at: now,
      },
    });
}

export async function patchHubRuntimeConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await getHubRuntimeConfigDocument();
  const next = mergeSection(current, section, patch);
  await upsertHubRuntimeConfigDocument(next);
  return next;
}

export async function replaceHubRuntimeConfigDocument(
  document: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await upsertHubRuntimeConfigDocument(document);
  return document;
}

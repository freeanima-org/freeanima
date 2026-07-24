import { eq } from "drizzle-orm";

import { llmConfigSchema } from "@freeanima/host/core/config/schemas/llm-config.ts";
import { HABITAT_RUNTIME_CONFIG_ID, habitatRuntimeConfig } from "@freeanima/host/core/db/schema";

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

function replaceSection(
  document: Record<string, unknown>,
  section: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...document,
    [section]: value,
  };
}

/** llm 允许只 patch providers：用 schema 默认补齐 backend / 空 profiles，再落库 */
function normalizeDocumentSection(
  document: Record<string, unknown>,
  section: string,
): Record<string, unknown> {
  if (section !== "llm") return document;
  return {
    ...document,
    llm: llmConfigSchema.parse(document.llm ?? {}),
  };
}

export { mergeSection, replaceSection };

export async function getHabitatRuntimeConfigDocument(): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db
    .select({ document: habitatRuntimeConfig.document })
    .from(habitatRuntimeConfig)
    .where(eq(habitatRuntimeConfig.id, HABITAT_RUNTIME_CONFIG_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return {};
  return row.document ?? {};
}

export async function upsertHabitatRuntimeConfigDocument(
  document: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(habitatRuntimeConfig)
    .values({
      id: HABITAT_RUNTIME_CONFIG_ID,
      document,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: habitatRuntimeConfig.id,
      set: {
        document,
        updated_at: now,
      },
    });
}

export async function patchHabitatRuntimeConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await getHabitatRuntimeConfigDocument();
  const next = normalizeDocumentSection(mergeSection(current, section, patch), section);
  await upsertHabitatRuntimeConfigDocument(next);
  return next;
}

/** 整段替换（用于 acp_agents / mcp_servers 等 record 配置，支持删除条目）。 */
export async function replaceHabitatRuntimeConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await getHabitatRuntimeConfigDocument();
  const next = normalizeDocumentSection(replaceSection(current, section, value), section);
  await upsertHabitatRuntimeConfigDocument(next);
  return next;
}

export async function replaceHabitatRuntimeConfigDocument(
  document: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await upsertHabitatRuntimeConfigDocument(document);
  return document;
}

import { eq } from "drizzle-orm";

import { llmConfigSchema } from "@freeanima/core/config/schemas/llm-config.ts";
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
  const next = normalizeDocumentSection(mergeSection(current, section, patch), section);
  await upsertHubRuntimeConfigDocument(next);
  return next;
}

/** 整段替换（用于 acp_agents / mcp_servers 等 record 配置，支持删除条目）。 */
export async function replaceHubRuntimeConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await getHubRuntimeConfigDocument();
  const next = normalizeDocumentSection(replaceSection(current, section, value), section);
  await upsertHubRuntimeConfigDocument(next);
  return next;
}

export async function replaceHubRuntimeConfigDocument(
  document: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await upsertHubRuntimeConfigDocument(document);
  return document;
}

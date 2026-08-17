import { eq } from "drizzle-orm";

import { companionConfigSchema } from "@freeanima/habitat/core/config/schemas/companion.ts";
import { llmConfigSchema } from "@freeanima/habitat/core/config/schemas/llm-config.ts";
import { habitatRuntimeConfig } from "@freeanima/habitat/core/db/schema";

import { getDb } from "../client.ts";

/** 条目级合并；`null` 表示删除该键（用于连接/方案/场景删除） */
function mergeMapEntries(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...base };
  for (const [id, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[id];
    } else {
      next[id] = value;
    }
  }
  return next;
}

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

  // llm.providers / scenes / profiles：条目级合并，避免只 patch 一条连接时冲掉其它条目
  // 条目值为 null → 删除（patch 缺键仍保留，故删除必须显式传 null）
  if (section === "llm") {
    const next: Record<string, unknown> = { ...existing, ...patch };
    for (const key of ["providers", "profiles", "scenes"] as const) {
      if (patch[key] != null && typeof patch[key] === "object" && !Array.isArray(patch[key])) {
        const base =
          typeof existing[key] === "object" &&
          existing[key] != null &&
          !Array.isArray(existing[key])
            ? (existing[key] as Record<string, unknown>)
            : {};
        next[key] = mergeMapEntries(base, patch[key] as Record<string, unknown>);
      }
    }
    // profile_bindings：null 表示「同主场景」，需保留键，不能当删除
    if (
      patch.profile_bindings != null &&
      typeof patch.profile_bindings === "object" &&
      !Array.isArray(patch.profile_bindings)
    ) {
      const base =
        typeof existing.profile_bindings === "object" &&
        existing.profile_bindings != null &&
        !Array.isArray(existing.profile_bindings)
          ? (existing.profile_bindings as Record<string, unknown>)
          : {};
      next.profile_bindings = { ...base, ...(patch.profile_bindings as Record<string, unknown>) };
    }
    return { ...document, [section]: next };
  }

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
function normalizeSectionValue(section: string, value: unknown): unknown {
  if (section === "llm") {
    return llmConfigSchema.parse(value ?? {});
  }
  if (section === "companion") {
    return companionConfigSchema.parse(value ?? {});
  }
  return value ?? {};
}

export { mergeSection, replaceSection };

/** 组装为旧「document」形态，供 boot / parseRuntimeConfig */
export async function getHabitatRuntimeConfigDocument(): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db
    .select({
      section: habitatRuntimeConfig.section,
      value: habitatRuntimeConfig.value,
    })
    .from(habitatRuntimeConfig);
  const document: Record<string, unknown> = {};
  for (const row of rows) {
    document[row.section] = row.value;
  }
  return document;
}

async function upsertSectionRow(section: string, value: unknown): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(habitatRuntimeConfig)
    .values({
      section,
      value,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: habitatRuntimeConfig.section,
      set: {
        value,
        updated_at: now,
      },
    });
}

export async function upsertHabitatRuntimeConfigDocument(
  document: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ section: habitatRuntimeConfig.section })
    .from(habitatRuntimeConfig);
  const nextKeys = new Set(Object.keys(document));
  for (const row of existing) {
    if (!nextKeys.has(row.section)) {
      await db.delete(habitatRuntimeConfig).where(eq(habitatRuntimeConfig.section, row.section));
    }
  }
  for (const [section, raw] of Object.entries(document)) {
    await upsertSectionRow(section, normalizeSectionValue(section, raw));
  }
}

export async function patchHabitatRuntimeConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db
    .select({ value: habitatRuntimeConfig.value })
    .from(habitatRuntimeConfig)
    .where(eq(habitatRuntimeConfig.section, section))
    .limit(1);
  const existingRaw = rows[0]?.value;
  const existing =
    typeof existingRaw === "object" && existingRaw != null && !Array.isArray(existingRaw)
      ? (existingRaw as Record<string, unknown>)
      : {};
  const merged = mergeSection({ [section]: existing }, section, patch);
  await upsertSectionRow(section, normalizeSectionValue(section, merged[section]));
  return getHabitatRuntimeConfigDocument();
}

/** 整段替换（用于 mcp_servers / models 等 record 配置，支持删除条目）。 */
export async function replaceHabitatRuntimeConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await upsertSectionRow(section, normalizeSectionValue(section, value));
  return getHabitatRuntimeConfigDocument();
}

export async function replaceHabitatRuntimeConfigDocument(
  document: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await upsertHabitatRuntimeConfigDocument(document);
  return getHabitatRuntimeConfigDocument();
}

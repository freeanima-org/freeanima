import {
  defaultCompanionRuntimeConfig,
  companionConfigSchema,
  companionBehaviorSchema,
  companionModelCachePath,
  type CompanionRuntimeConfig,
} from "@freeanima/host/core/config/schemas/companion.ts";
import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import {
  getHabitatRuntimeConfigDocument,
  replaceHabitatRuntimeConfigSection,
} from "@freeanima/host/core/db/pg";
import { COMPANION_PROFILE_COMPONENT } from "@freeanima/host/core/db/schema/entity";
import { listEntities, deleteEntity } from "@freeanima/host/core/db/pg/entity";
import { logComponent } from "@freeanima/host/platform/logging";
import { mergeBehavior } from "./behavior.ts";
import type { CompanionConfig } from "./types.ts";

type PatchableConfig = {
  replaceSection(section: string, value: Record<string, unknown>): Promise<unknown>;
};

function coerceCompanionConfig(raw: unknown): CompanionConfig {
  const parsed = companionConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const defaults = defaultCompanionRuntimeConfig();
  if (raw && typeof raw === "object" && "behavior" in raw) {
    const behavior = companionBehaviorSchema.safeParse(raw.behavior);
    if (behavior.success) {
      return { ...defaults, behavior: behavior.data };
    }
  }
  return defaults;
}

function tryGetPatchableConfig(): PatchableConfig | null {
  try {
    const cfg = getActiveRuntimeConfig();
    const maybe = cfg as unknown as PatchableConfig;
    if (typeof maybe.replaceSection === "function") return maybe;
  } catch {
    /* boot / unit 未 bind */
  }
  return null;
}

function readFromActiveMemory(): CompanionConfig | null {
  try {
    const raw = getActiveRuntimeConfig().data.companion;
    if (raw == null) return null;
    return coerceCompanionConfig(raw);
  } catch {
    return null;
  }
}

function syncActiveMemory(next: CompanionRuntimeConfig): void {
  try {
    const cfg = getActiveRuntimeConfig();
    cfg.update({ ...cfg.data, companion: next });
  } catch {
    /* ignore */
  }
}

/**
 * 旧 companion_profile / 旧结构段：不迁 models/motions（须重传）。
 * 仅尝试保留 behavior，并软删遗留 entity。
 */
async function migrateLegacyCompanionIfNeeded(): Promise<void> {
  const doc = await getHabitatRuntimeConfigDocument();
  if (doc.companion != null) {
    const ok = companionConfigSchema.safeParse(doc.companion);
    if (ok.success) return;
    const coerced = coerceCompanionConfig(doc.companion);
    await persistCompanionConfig(coerced);
    logComponent("companion").info("reset invalid companion runtime section (re-upload assets)");
    return;
  }

  const rows = await listEntities({
    primary_component: COMPANION_PROFILE_COMPONENT,
    limit: 20,
  });
  let behavior = defaultCompanionRuntimeConfig().behavior;
  const body = rows[0]?.body;
  if (body && typeof body === "object" && "behavior" in body) {
    const parsed = companionBehaviorSchema.safeParse((body as { behavior: unknown }).behavior);
    if (parsed.success) behavior = parsed.data;
  }

  const next = { ...defaultCompanionRuntimeConfig(), behavior };
  await persistCompanionConfig(next);
  for (const row of rows) {
    await deleteEntity(row.id);
  }
  if (rows.length > 0) {
    logComponent("companion").info(
      "dropped legacy companion_profile library; kept behavior; re-upload models/motions",
      { count: rows.length },
    );
  }
}

export function activeModelPath(cfg: CompanionConfig): string {
  const id = cfg.active_object_file_id;
  if (id == null) return "";
  return companionModelCachePath(id);
}

export function habitatUrlFromEnv(): string {
  const fromEnv = process.env.FREEANIMA_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:2658";
}

export async function loadCompanionConfig(): Promise<CompanionConfig> {
  const fromMem = readFromActiveMemory();
  if (fromMem && companionConfigSchema.safeParse(fromMem).success) {
    return fromMem;
  }

  await migrateLegacyCompanionIfNeeded();

  const again = readFromActiveMemory();
  if (again) return again;

  const doc = await getHabitatRuntimeConfigDocument();
  if (doc.companion != null) {
    const cfg = coerceCompanionConfig(doc.companion);
    syncActiveMemory(cfg);
    return cfg;
  }

  const defaults = defaultCompanionRuntimeConfig();
  await persistCompanionConfig(defaults);
  return defaults;
}

async function persistCompanionConfig(next: CompanionRuntimeConfig): Promise<void> {
  const value = companionConfigSchema.parse(next) as unknown as Record<string, unknown>;
  const store = tryGetPatchableConfig();
  if (store) {
    await store.replaceSection("companion", value);
    return;
  }
  await replaceHabitatRuntimeConfigSection("companion", value);
  syncActiveMemory(next);
}

export async function saveCompanionConfig(
  patch: Partial<CompanionConfig>,
): Promise<CompanionConfig> {
  const current = await loadCompanionConfig();
  const next = companionConfigSchema.parse({
    active_object_file_id:
      patch.active_object_file_id !== undefined
        ? patch.active_object_file_id
        : current.active_object_file_id,
    models: patch.models ?? current.models,
    motion_library: patch.motion_library ?? current.motion_library,
    motion_slots: patch.motion_slots ?? current.motion_slots,
    behavior: mergeBehavior({ ...current.behavior, ...patch.behavior }),
  });
  await persistCompanionConfig(next);
  return next;
}

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CompanionProfileBody } from "@freeanima/host/core/db/schema/entity";
import { mergeBehavior } from "./behavior.ts";
import { getOrCreateCompanionProfile, saveCompanionProfile } from "./profile-store.ts";
import { companionConfigPath, ensureCompanionDataDir } from "./paths.ts";
import { PLACEHOLDER_MODEL_PATH } from "./model-path.ts";
import type { CompanionConfig, ModelEntry, MotionLibraryEntry } from "./types.ts";

function toModelEntry(entry: CompanionProfileBody["models"][number]): ModelEntry {
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    ...(entry.content_hash !== undefined ? { content_hash: entry.content_hash } : {}),
  };
}

function toMotionEntry(entry: CompanionProfileBody["motion_library"][number]): MotionLibraryEntry {
  return {
    id: entry.id,
    name: entry.name,
    file: entry.file,
    ...(entry.content_hash !== undefined ? { content_hash: entry.content_hash } : {}),
  };
}

function profileToConfig(profile: CompanionProfileBody): CompanionConfig {
  return {
    active_model_id: profile.active_model_id,
    models: profile.models.map(toModelEntry),
    motion_library: profile.motion_library.map(toMotionEntry),
    motion_slots: profile.motion_slots,
    behavior: profile.behavior,
  };
}

export function activeModelPath(cfg: CompanionConfig): string {
  const active = cfg.models.find((m) => m.id === cfg.active_model_id);
  return active?.path ?? PLACEHOLDER_MODEL_PATH;
}

export async function loadCompanionConfig(): Promise<CompanionConfig> {
  const profile = await getOrCreateCompanionProfile();
  const cfg = profileToConfig(profile);
  writeLocalCache(cfg);
  return cfg;
}

export async function saveCompanionConfig(
  patch: Partial<CompanionConfig>,
): Promise<CompanionConfig> {
  const current = await getOrCreateCompanionProfile();
  const next = await saveCompanionProfile({
    active_model_id: patch.active_model_id ?? current.active_model_id,
    models: patch.models ?? current.models,
    motion_library: patch.motion_library ?? current.motion_library,
    motion_slots: patch.motion_slots ?? current.motion_slots,
    behavior: mergeBehavior({ ...current.behavior, ...patch.behavior }),
  });
  const cfg = profileToConfig(next);
  writeLocalCache(cfg);
  return cfg;
}

function writeLocalCache(cfg: CompanionConfig): void {
  ensureCompanionDataDir();
  writeFileSync(companionConfigPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

export function readLocalCache(): CompanionConfig | null {
  const path = companionConfigPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CompanionConfig;
  } catch {
    return null;
  }
}

export function habitatUrlFromEnv(): string {
  const fromEnv = process.env.FREEANIMA_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:2658";
}

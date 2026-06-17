import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { companionConfigPath, ensureCompanionDataDir } from "./paths.ts";
import { PLACEHOLDER_MODEL_PATH } from "./model-path.ts";

export const LOCOMOTION_SLOTS = ["walk", "climb"] as const;
export type LocomotionSlot = (typeof LOCOMOTION_SLOTS)[number];

export type CompanionConfig = {
  hub_url: string;
  model_path: string;
  /** 巡逻位移动作：walk=横向走路，climb=纵向攀爬；值为 motions 目录下的 .vrma 文件名 */
  locomotion?: Partial<Record<LocomotionSlot, string>>;
};

const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");

export const DEFAULT_CONFIG: CompanionConfig = {
  hub_url: HUB_URL,
  model_path: PLACEHOLDER_MODEL_PATH,
};

export function loadConfig(): CompanionConfig {
  ensureCompanionDataDir();
  const configPath = companionConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<CompanionConfig>;
    return {
      hub_url: raw.hub_url ?? DEFAULT_CONFIG.hub_url,
      model_path: raw.model_path ?? DEFAULT_CONFIG.model_path,
      locomotion: raw.locomotion ?? {},
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(patch: Partial<CompanionConfig>): CompanionConfig {
  ensureCompanionDataDir();
  const next = { ...loadConfig(), ...patch };
  writeFileSync(companionConfigPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function hubUrlFromConfig(): string {
  return loadConfig().hub_url.replace(/\/$/, "");
}

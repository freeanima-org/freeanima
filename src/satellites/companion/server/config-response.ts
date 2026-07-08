import { existsSync, readFileSync } from "node:fs";
import { COMPANION_APP_ID } from "../shared/constants.ts";
import { getSapInstanceId, isSapConnected } from "./sap/hub.ts";
import { hubUrlFromConfig, type CompanionConfig } from "./config.ts";
import { companionConfigPath, ensureCompanionDataDir } from "./paths.ts";
import { activeModelPath } from "./config.ts";
import { isModelPathAvailable } from "./model-path.ts";
import {
  DEFAULT_BEHAVIOR,
  emptyMotionSlots,
  type CompanionBehavior,
  type ModelEntry,
  type MotionLibraryEntry,
  type MotionSlotsConfig,
} from "../shared/companion-schema.ts";

export type ClientCompanionConfig = {
  app_id: typeof COMPANION_APP_ID;
  instance_id: string;
  hub_url: string;
  model_path: string;
  model_available: boolean;
  sap_connected: boolean;
  fbx_import_available: boolean;
  active_model_id: string;
  models: ModelEntry[];
  motion_library: MotionLibraryEntry[];
  motion_slots: MotionSlotsConfig;
  behavior: CompanionBehavior;
};

function loadLocalCache(): Partial<CompanionConfig> {
  ensureCompanionDataDir();
  const path = companionConfigPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Partial<CompanionConfig>;
  } catch {
    return {};
  }
}

export function clientCompanionConfig(): ClientCompanionConfig {
  const cached = loadLocalCache();
  const behavior = { ...DEFAULT_BEHAVIOR, ...cached.behavior };
  const models = cached.models ?? [];
  const motion_library = cached.motion_library ?? [];
  const motion_slots = cached.motion_slots ?? emptyMotionSlots();
  const active_model_id = cached.active_model_id ?? "";
  const cfg: CompanionConfig = {
    hub_url: hubUrlFromConfig(),
    active_model_id,
    models,
    motion_library,
    motion_slots,
    behavior,
  };
  const model_path = activeModelPath(cfg);
  return {
    app_id: COMPANION_APP_ID,
    instance_id: getSapInstanceId(),
    hub_url: hubUrlFromConfig(),
    models,
    motion_library,
    motion_slots,
    behavior,
    active_model_id,
    model_path,
    model_available: isModelPathAvailable(model_path),
    sap_connected: isSapConnected(),
    fbx_import_available: false,
  };
}

import {
  companionModelCachePath,
  companionMotionCachePath,
  DEFAULT_COMPANION_BEHAVIOR,
  emptyCompanionMotionSlots,
  type CompanionModelEntry,
  type CompanionMotionEntry,
  type CompanionRuntimeConfig,
} from "@freeanima/host/core/config/schemas/companion.ts";
import { motionManifest } from "./motion-manifest.ts";

export const MOTION_SLOT_IDS = ["idle", "rest", "walk", "climb", "in_place"] as const;
export type MotionSlotId = (typeof MOTION_SLOT_IDS)[number];

export const MOTION_SLOT_LABELS: Record<MotionSlotId, string> = {
  idle: "待机",
  rest: "休息",
  walk: "横向移动",
  climb: "纵向移动",
  in_place: "原地动作",
};

export const LEGACY_IN_PLACE_SLOT_PREFIX = "in_place_";

export type MotionLibraryEntry = CompanionMotionEntry;
export type ModelEntry = CompanionModelEntry;
export type CompanionBehavior = CompanionRuntimeConfig["behavior"];
export type MotionSlotsConfig = CompanionRuntimeConfig["motion_slots"];

export const DEFAULT_BEHAVIOR: CompanionBehavior = { ...DEFAULT_COMPANION_BEHAVIOR };

export function emptyMotionSlots(): MotionSlotsConfig {
  return emptyCompanionMotionSlots();
}

/** @deprecated 本地 manifest 文件名槽位；Habitat 配置用 object_file_id */
export function defaultMotionSlotsFromManifest(): Record<MotionSlotId, string[]> {
  return {
    idle: [motionManifest.idle],
    rest: [],
    walk: motionManifest.locomotion?.walk ? [motionManifest.locomotion.walk] : [],
    climb: motionManifest.locomotion?.climb ? [motionManifest.locomotion.climb] : [],
    in_place: [...new Set<string>(Object.values(motionManifest.zones))],
  };
}

export type CompanionConfigV2 = CompanionRuntimeConfig & {
  habitat_url: string;
  model_path?: string;
};

export { companionModelCachePath, companionMotionCachePath };

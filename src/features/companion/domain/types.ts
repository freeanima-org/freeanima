import type {
  CompanionModelEntry,
  CompanionMotionEntry,
  CompanionRuntimeConfig,
} from "@freeanima/host/core/config/schemas/companion.ts";
import {
  DEFAULT_COMPANION_BEHAVIOR,
  emptyCompanionMotionSlots,
  companionModelCachePath,
} from "@freeanima/host/core/config/schemas/companion.ts";
import { motionManifest } from "./motion-manifest.ts";

export type LocomotionSlot = "walk" | "climb";

export const LOCOMOTION_SLOTS = ["walk", "climb"] as const;

export const LOCOMOTION_SLOT_LABELS: Record<LocomotionSlot, string> = {
  walk: "走路",
  climb: "攀爬",
};

export const MOTION_SLOT_IDS = ["idle", "rest", "walk", "climb", "in_place"] as const;
export type MotionSlotId = (typeof MOTION_SLOT_IDS)[number];

export const LEGACY_IN_PLACE_SLOT_PREFIX = "in_place_";

export type ModelEntry = CompanionModelEntry;
export type MotionLibraryEntry = CompanionMotionEntry;

export type CompanionBehavior = CompanionRuntimeConfig["behavior"];
export type MotionSlotsConfig = CompanionRuntimeConfig["motion_slots"];

export const DEFAULT_BEHAVIOR: CompanionBehavior = { ...DEFAULT_COMPANION_BEHAVIOR };

export function emptyMotionSlots(): MotionSlotsConfig {
  return emptyCompanionMotionSlots();
}

/** @deprecated manifest 文件名槽位仅供本地 dev 遗留路径；Habitat 配置用 object_file_id */
export function defaultMotionSlotsFromManifest(): Record<MotionSlotId, string[]> {
  const slots = {
    idle: [] as string[],
    rest: [] as string[],
    walk: [] as string[],
    climb: [] as string[],
    in_place: [] as string[],
  };
  slots.idle = [motionManifest.idle];
  slots.walk = motionManifest.locomotion?.walk ? [motionManifest.locomotion.walk] : [];
  slots.climb = motionManifest.locomotion?.climb ? [motionManifest.locomotion.climb] : [];
  const inPlaceFiles = new Set<string>(Object.values(motionManifest.zones));
  slots.in_place = [...inPlaceFiles];
  return slots;
}

export type CompanionConfig = CompanionRuntimeConfig;

export const FBX_IMPORT_UNAVAILABLE_MSG =
  "未找到 FBX2glTF 转换器，请直接导入 .vrma；或在 Habitat 宿主机执行 just misc setup-fbx。";

export { companionModelCachePath };

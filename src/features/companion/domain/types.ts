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

export type ModelEntry = {
  id: string;
  name: string;
  path: string;
  content_hash?: string;
};

export type MotionLibraryEntry = {
  id: string;
  name: string;
  file: string;
  content_hash?: string;
};

export type CompanionBehavior = {
  patrol_enabled: boolean;
  idle_patrol_delay_sec: number;
  patrol_pause_sec: number;
  patrol_speed_px: number;
  double_click_patrol: boolean;
  startup_walk_enabled: boolean;
};

export const DEFAULT_BEHAVIOR: CompanionBehavior = {
  patrol_enabled: true,
  idle_patrol_delay_sec: 180,
  patrol_pause_sec: 10,
  patrol_speed_px: 95,
  double_click_patrol: true,
  startup_walk_enabled: true,
};

export type MotionSlotsConfig = Record<MotionSlotId, string[]>;

export function emptyMotionSlots(): MotionSlotsConfig {
  const slots = {} as MotionSlotsConfig;
  for (const id of MOTION_SLOT_IDS) {
    slots[id] = [];
  }
  return slots;
}

export function defaultMotionSlotsFromManifest(): MotionSlotsConfig {
  const slots = emptyMotionSlots();
  slots.idle = [motionManifest.idle];
  slots.walk = motionManifest.locomotion?.walk ? [motionManifest.locomotion.walk] : [];
  slots.climb = motionManifest.locomotion?.climb ? [motionManifest.locomotion.climb] : [];
  const inPlaceFiles = new Set<string>(Object.values(motionManifest.zones));
  slots.in_place = [...inPlaceFiles];
  return slots;
}

export type CompanionConfig = {
  active_model_id: string;
  models: ModelEntry[];
  motion_library: MotionLibraryEntry[];
  motion_slots: MotionSlotsConfig;
  behavior: CompanionBehavior;
};

export const FBX_IMPORT_UNAVAILABLE_MSG =
  "未找到 FBX2glTF 转换器，请直接导入 .vrma；或在 Habitat 宿主机执行 just misc setup-fbx。";

export { newModelId, newMotionId } from "./asset-id.ts";

import { motionManifest } from "./motion-manifest.ts";

/** 动作槽位（Motion Slot）— 系统预留的播放位 */
export const MOTION_SLOT_IDS = ["idle", "rest", "walk", "climb", "in_place"] as const;

export type MotionSlotId = (typeof MOTION_SLOT_IDS)[number];

export const MOTION_SLOT_LABELS: Record<MotionSlotId, string> = {
  idle: "待机",
  rest: "休息",
  walk: "横向移动",
  climb: "纵向移动",
  in_place: "原地动作",
};

/** 旧版按部位拆分的槽位前缀；加载配置时合并到 in_place */
export const LEGACY_IN_PLACE_SLOT_PREFIX = "in_place_";

export type MotionLibraryEntry = {
  /** 稳定 UUID，配置与槽位引用此 id */
  id: string;
  /** 显示名称（可改，不影响磁盘文件） */
  name: string;
  /** motions 目录下的 .vrma 文件名（导入后为 `{id}.vrma`） */
  file: string;
};

export type ModelEntry = {
  /** 稳定 UUID，配置引用此 id */
  id: string;
  /** 显示名称（可改，不影响磁盘文件） */
  name: string;
  /** 如 /models/{id}.vrm */
  path: string;
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

/** 从官方 manifest 生成默认槽位映射（按文件名，供首次同步磁盘动作库） */
export function defaultMotionSlotsFromManifest(): MotionSlotsConfig {
  const slots = emptyMotionSlots();
  slots.idle = [motionManifest.idle];
  slots.walk = motionManifest.locomotion?.walk ? [motionManifest.locomotion.walk] : [];
  slots.climb = motionManifest.locomotion?.climb ? [motionManifest.locomotion.climb] : [];
  const inPlaceFiles = new Set<string>(Object.values(motionManifest.zones));
  slots.in_place = [...inPlaceFiles];
  return slots;
}

export type CompanionConfigV2 = {
  habitat_url: string;
  model_path?: string;
  active_model_id: string;
  models: ModelEntry[];
  motion_library: MotionLibraryEntry[];
  motion_slots: MotionSlotsConfig;
  behavior: CompanionBehavior;
};

export { newModelId, newMotionId } from "./asset-id.ts";

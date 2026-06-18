import type {
  CompanionBehavior,
  ModelEntry,
  MotionLibraryEntry,
  MotionSlotsConfig,
} from "./companion-schema.ts";

export type {
  CompanionBehavior,
  ModelEntry,
  MotionLibraryEntry,
  MotionSlotId,
  MotionSlotsConfig,
} from "./companion-schema.ts";
export { MOTION_SLOT_IDS, MOTION_SLOT_LABELS, DEFAULT_BEHAVIOR } from "./companion-schema.ts";

export const COMPANION_APP_ID = "companion" as const;

/** Sidecar HTTP 默认端口与扫描范围（dev / Tauri 生产一致） */
export const SATELLITE_PORT_START = 4176;
export const SATELLITE_PORT_ATTEMPTS = 10;
export const SATELLITE_PORT_MAX = SATELLITE_PORT_START + SATELLITE_PORT_ATTEMPTS - 1;

/** 与 tauri.conf.json companion 窗口尺寸一致（逻辑 px） */
export const COMPANION_WINDOW_WIDTH = 160;
export const COMPANION_WINDOW_HEIGHT = 260;

/** @deprecated 使用 MotionSlotId walk/climb */
export const LOCOMOTION_SLOTS = ["walk", "climb"] as const;
export type LocomotionSlot = (typeof LOCOMOTION_SLOTS)[number];

export const LOCOMOTION_SLOT_LABELS: Record<LocomotionSlot, string> = {
  walk: "走路",
  climb: "攀爬",
};

export type ClientCompanionConfig = {
  app_id: typeof COMPANION_APP_ID;
  instance_id: string;
  hub_url: string;
  model_path: string;
  model_available: boolean;
  sap_connected: boolean;
  active_model_id: string;
  models: ModelEntry[];
  motion_library: MotionLibraryEntry[];
  motion_slots: MotionSlotsConfig;
  behavior: CompanionBehavior;
};

export type BubbleItem = {
  id: string;
  text: string;
  createdAt: number;
};

export type PlaySlotCommand = {
  id: string;
  slot: string;
  motionId?: string;
};

export type RuntimeState = {
  bubble: {
    current: BubbleItem | null;
    pending: number;
    version: number;
  };
  playVersion: number;
  play: PlaySlotCommand[];
};

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

/** Sidecar HTTP 默认端口与扫描范围（dev / Electron 生产一致） */
export const SATELLITE_PORT_START = 4176;
export const SATELLITE_PORT_ATTEMPTS = 10;
export const SATELLITE_PORT_MAX = SATELLITE_PORT_START + SATELLITE_PORT_ATTEMPTS - 1;

/** 与 Electron companion 窗口尺寸一致（逻辑 px） */
export const COMPANION_WINDOW_WIDTH = 160;
export const COMPANION_WINDOW_HEIGHT = 260;

/** Electron 设置窗口尺寸（逻辑 px） */
export const SETTINGS_WINDOW_WIDTH = 840;
export const SETTINGS_WINDOW_HEIGHT = 720;
export const SETTINGS_WINDOW_WIDTH_WIN = 960;
export const SETTINGS_WINDOW_HEIGHT_WIN = 820;

/** sidecar 未找到 FBX2glTF 原生转换器时的用户提示 */
export const FBX_IMPORT_UNAVAILABLE_MSG =
  "未找到 FBX2glTF 转换器，请直接导入 .vrma；或在 satellites/companion 执行 bun run setup:fbx 下载。";

export const LOCOMOTION_SLOTS = ["walk", "climb"] as const;
export type LocomotionSlot = (typeof LOCOMOTION_SLOTS)[number];

export const LOCOMOTION_SLOT_LABELS: Record<LocomotionSlot, string> = {
  walk: "走路",
  climb: "攀爬",
};

export type ClientCompanionConfig = {
  app_id: typeof COMPANION_APP_ID;
  instance_id: string;
  habitat_url: string;
  /** @deprecated */ hub_url?: string;
  model_path: string;
  model_available: boolean;
  remote_tools_connected: boolean;
  fbx_import_available: boolean;
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

export type RuntimeWsMessage = {
  type: "runtime";
  bubble: RuntimeState["bubble"];
  play: PlaySlotCommand[];
};

/** Sidecar HTTP 默认端口与扫描范围（dev / Tauri 生产一致） */
export const SATELLITE_PORT_START = 4176;
export const SATELLITE_PORT_ATTEMPTS = 10;
export const SATELLITE_PORT_MAX = SATELLITE_PORT_START + SATELLITE_PORT_ATTEMPTS - 1;

/** 与 tauri.conf.json companion 窗口尺寸一致（逻辑 px） */
export const COMPANION_WINDOW_WIDTH = 160;
export const COMPANION_WINDOW_HEIGHT = 260;

export const COMPANION_APP_ID = "companion" as const;

export const LOCOMOTION_SLOTS = ["walk", "climb"] as const;
export type LocomotionSlot = (typeof LOCOMOTION_SLOTS)[number];

export const LOCOMOTION_SLOT_LABELS: Record<LocomotionSlot, string> = {
  walk: "走路",
  climb: "攀爬",
};

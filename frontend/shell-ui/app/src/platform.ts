import type { SettingsPlatform } from "@freeanima/shell-sdk/settings";

import { detectLayoutMode, type LayoutMode } from "./layout-mode.ts";

export type PlatformDetectContext = {
  layoutMode?: LayoutMode;
};

/** 设置页 chrome：跟布局粗档（窄/compact→mobile，中宽/expanded→desktop） */
export function resolveSettingsPlatform(ctx: PlatformDetectContext): SettingsPlatform {
  if (ctx.layoutMode === "compact") return "mobile";
  return "desktop";
}

export function detectPlatform(): SettingsPlatform {
  return resolveSettingsPlatform({ layoutMode: detectLayoutMode() });
}

export function isSettingsOnlyRoute(): boolean {
  return window.location.pathname.startsWith("/settings");
}

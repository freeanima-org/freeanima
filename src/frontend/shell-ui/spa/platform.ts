import type { SettingsPlatform } from "@freeanima/frontend/shell-sdk/settings";
import { getShellKind } from "@freeanima/frontend/shell-sdk/shell-runtime.ts";

import { detectLayoutMode, type LayoutMode } from "./layout-mode.ts";

export type PlatformDetectContext = {
  layoutMode?: LayoutMode;
};

/** 设置页 chrome：跟布局粗档（窄/compact→mobile tabs，中宽/expanded→desktop 侧栏） */
export function resolveSettingsChromePlatform(ctx: PlatformDetectContext): SettingsPlatform {
  if (ctx.layoutMode === "compact") return "mobile";
  return "desktop";
}

/** 设置 section 列表与字段：跟壳子维（Electron→desktop，Capacitor→mobile），不跟视口布局 */
export function resolveSettingsContentPlatform(): SettingsPlatform {
  const kind = getShellKind();
  if (kind === "capacitor") return "mobile";
  return "desktop";
}

/** 设置页 chrome 平台（布局维） */
export function detectSettingsChromePlatform(): SettingsPlatform {
  return resolveSettingsChromePlatform({ layoutMode: detectLayoutMode() });
}

export function isSettingsOnlyRoute(): boolean {
  return window.location.pathname.startsWith("/settings");
}

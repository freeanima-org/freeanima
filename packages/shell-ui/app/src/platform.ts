import type { SettingsPlatform } from "@freeanima/shell-sdk/settings";

import { detectLayoutMode, type LayoutMode } from "./layout-mode.ts";

export type PlatformDetectContext = {
  isElectron?: boolean;
  isNativeShell?: boolean;
  isCapacitor?: boolean;
  layoutMode?: LayoutMode;
};

export function resolveSettingsPlatform(ctx: PlatformDetectContext): SettingsPlatform {
  if (ctx.isElectron) return "desktop";
  if (ctx.isNativeShell || ctx.isCapacitor) return "mobile";
  if (ctx.layoutMode === "compact") return "mobile";
  return "desktop";
}

function isCapacitorRuntime(): boolean {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() ?? cap);
}

export function detectPlatform(): SettingsPlatform {
  const layoutMode = detectLayoutMode();
  return resolveSettingsPlatform({
    isElectron: window.satelliteShell?.isElectron,
    isNativeShell: window.satelliteShell?.isNativeShell,
    isCapacitor: isCapacitorRuntime(),
    layoutMode,
  });
}

export function isSettingsOnlyRoute(): boolean {
  return window.location.pathname.startsWith("/settings");
}

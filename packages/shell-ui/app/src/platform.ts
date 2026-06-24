import type { SettingsPlatform } from "@freeanima/satellite-sdk";

export function detectPlatform(): SettingsPlatform {
  if (window.satelliteShell?.isElectron) return "desktop";
  if (window.satelliteShell?.isNativeShell) return "mobile";
  return "desktop";
}

export function isSettingsOnlyRoute(): boolean {
  return window.location.pathname.startsWith("/settings");
}

import type { SettingsPlatform } from "@freeanima/shell-sdk/settings";

export type PlatformDetectContext = {
  isElectron?: boolean;
  isNativeShell?: boolean;
};

export function resolveSettingsPlatform(ctx: PlatformDetectContext): SettingsPlatform {
  if (ctx.isElectron) return "desktop";
  if (ctx.isNativeShell) return "mobile";
  return "desktop";
}

export function detectPlatform(): SettingsPlatform {
  return resolveSettingsPlatform({
    isElectron: window.satelliteShell?.isElectron,
    isNativeShell: window.satelliteShell?.isNativeShell,
  });
}

export function isSettingsOnlyRoute(): boolean {
  return window.location.pathname.startsWith("/settings");
}

import type { SettingsPlatform } from "@freeanima/satellite-sdk";

export type PlatformDetectContext = {
  isElectron?: boolean;
  isNativeShell?: boolean;
  hasSettingsShellClientApi?: boolean;
};

export function resolveSettingsPlatform(ctx: PlatformDetectContext): SettingsPlatform {
  if (ctx.isElectron) return "desktop";
  if (ctx.isNativeShell) return "mobile";
  if (ctx.hasSettingsShellClientApi) return "mobile";
  return "desktop";
}

export function detectPlatform(): SettingsPlatform {
  return resolveSettingsPlatform({
    isElectron: window.satelliteShell?.isElectron,
    isNativeShell: window.satelliteShell?.isNativeShell,
    hasSettingsShellClientApi: Boolean(window.settingsShellClientApi),
  });
}

export function isSettingsOnlyRoute(): boolean {
  return window.location.pathname.startsWith("/settings");
}

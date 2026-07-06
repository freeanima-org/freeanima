import type { SatelliteShellApi } from "@freeanima/shell-sdk/shell-api";

/** 未配置 Hub API Token 时需先完成引导（Web / 桌面 Electron；移动原生壳层除外） */
export function needsHubSetup(
  shell: SatelliteShellApi | undefined = window.satelliteShell,
): boolean {
  if (!shell) return true;
  if (shell.isNativeShell && !shell.isElectron) return false;
  return !shell.remoteAuth?.token?.trim();
}

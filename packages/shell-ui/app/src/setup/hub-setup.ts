import type { SatelliteShellApi } from "@freeanima/shell-sdk/shell-api";

/** 浏览器 Web 壳层：未配置 Hub API Token 时需先完成引导 */
export function needsHubSetup(shell: SatelliteShellApi | undefined = window.satelliteShell): boolean {
  if (!shell || shell.isElectron || shell.isNativeShell) return false;
  return !shell.remoteAuth?.token?.trim();
}

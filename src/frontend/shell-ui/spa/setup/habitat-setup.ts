import type { ShellApi } from "@freeanima/frontend/shell-sdk/shell-api";

/** 未配置 Habitat API Token 时需先完成引导（Web / Desktop / Mobile 统一） */
export function needsHabitatSetup(shell: ShellApi | undefined = window.portalShell): boolean {
  if (!shell) return true;
  return !shell.remoteAuth?.token?.trim();
}

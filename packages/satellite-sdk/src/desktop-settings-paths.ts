import { homedir } from "node:os";
import { join } from "node:path";

/** 桌面壳 UI 配置根目录；可用 FREEANIMA_DESKTOP_HOME 覆盖。 */
export function getDesktopHomeDir(home = process.env.FREEANIMA_DESKTOP_HOME): string {
  return home?.trim() || join(homedir(), ".anima-desktop");
}

export function desktopSettingsPath(home?: string): string {
  return join(getDesktopHomeDir(home), "settings.json");
}

/** @deprecated 旧路径，仅用于迁移 */
export function legacyShellClientConfigPath(animaHome = process.env.FREEANIMA_HOME): string {
  const root = animaHome?.trim() || join(homedir(), ".anima");
  return join(root, "shell-client.json");
}

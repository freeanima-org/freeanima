import {
  DEFAULT_SHELL_DEBUG,
  normalizeShellDebugConfig,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/frontend/shell-sdk";

import { DEBUG_VCONSOLE_ENABLED_KEY } from "./prefs-keys.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";

export const DEBUG_CONFIG_CHANGED_EVENT = "freeanima:debug-config-changed";

export async function loadShellDebugPrefs(): Promise<ShellDebugConfig> {
  const vConsole = await prefsGet({ key: DEBUG_VCONSOLE_ENABLED_KEY });
  return parseShellDebugConfig({
    vConsoleEnabled: vConsole.value === "1",
  });
}

export async function saveShellDebugPrefs(config: ShellDebugConfig): Promise<ShellDebugConfig> {
  const normalized = normalizeShellDebugConfig(config);
  await prefsSet({
    key: DEBUG_VCONSOLE_ENABLED_KEY,
    value: normalized.vConsoleEnabled ? "1" : "0",
  });
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
  return normalized;
}

export function defaultShellDebugPrefs(): ShellDebugConfig {
  return { ...DEFAULT_SHELL_DEBUG };
}

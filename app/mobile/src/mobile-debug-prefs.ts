import {
  DEFAULT_SHELL_DEBUG,
  normalizeShellDebugConfig,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/satellite-sdk";

import {
  DEBUG_SENTRY_DSN_KEY,
  DEBUG_SENTRY_ENABLED_KEY,
  DEBUG_VCONSOLE_ENABLED_KEY,
} from "./prefs-keys.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";

export const DEBUG_CONFIG_CHANGED_EVENT = "freeanima:debug-config-changed";

export async function loadShellDebugPrefs(): Promise<ShellDebugConfig> {
  const [enabled, dsn, vConsole] = await Promise.all([
    prefsGet({ key: DEBUG_SENTRY_ENABLED_KEY }),
    prefsGet({ key: DEBUG_SENTRY_DSN_KEY }),
    prefsGet({ key: DEBUG_VCONSOLE_ENABLED_KEY }),
  ]);
  return parseShellDebugConfig({
    sentryEnabled: enabled.value === "1",
    sentryDsn: dsn.value ?? "",
    vConsoleEnabled: vConsole.value === "1",
  });
}

export async function saveShellDebugPrefs(config: ShellDebugConfig): Promise<ShellDebugConfig> {
  const normalized = normalizeShellDebugConfig(config);
  await Promise.all([
    prefsSet({
      key: DEBUG_SENTRY_ENABLED_KEY,
      value: normalized.sentryEnabled ? "1" : "0",
    }),
    prefsSet({ key: DEBUG_SENTRY_DSN_KEY, value: normalized.sentryDsn }),
    prefsSet({
      key: DEBUG_VCONSOLE_ENABLED_KEY,
      value: normalized.vConsoleEnabled ? "1" : "0",
    }),
  ]);
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
  return normalized;
}

export function defaultShellDebugPrefs(): ShellDebugConfig {
  return { ...DEFAULT_SHELL_DEBUG };
}

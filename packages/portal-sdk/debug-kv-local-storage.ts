import { DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY, DEBUG_VCONSOLE_ENABLED_KEY } from "./settings/index.ts";
import {
  normalizeShellDebugConfig,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/shared/shell-config/debug-config.ts";
import { notifyDebugConfigChanged } from "./debug-config-events.ts";

/** WebView localStorage：调试 prefs（vConsole / Outbox Devtools） */
export function loadDebugKvFromLocalStorage(): ShellDebugConfig {
  return parseShellDebugConfig({
    vConsoleEnabled: localStorage.getItem(DEBUG_VCONSOLE_ENABLED_KEY) === "1",
    offlineOutboxDevtoolsEnabled: localStorage.getItem(DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY) === "1",
  });
}

export function saveDebugKvToLocalStorage(value: unknown): void {
  const cfg = normalizeShellDebugConfig(parseShellDebugConfig(value));
  localStorage.setItem(DEBUG_VCONSOLE_ENABLED_KEY, cfg.vConsoleEnabled ? "1" : "0");
  localStorage.setItem(
    DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY,
    cfg.offlineOutboxDevtoolsEnabled ? "1" : "0",
  );
  notifyDebugConfigChanged();
}

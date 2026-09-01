import {
  DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY,
  DEBUG_VCONSOLE_ENABLED_KEY,
} from "@freeanima/client/portal-sdk/settings";
import {
  normalizeShellDebugConfig,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/client/portal-sdk/shell-debug-config";
import { notifyDebugConfigChanged } from "@freeanima/client/app-frame/spa/debug-config-events.ts";

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

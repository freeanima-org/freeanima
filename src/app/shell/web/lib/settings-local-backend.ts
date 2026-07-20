import type { SettingsStorageScope } from "@freeanima/frontend/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/frontend/shell-sdk/settings";
import {
  DEBUG_VCONSOLE_ENABLED_KEY,
  HABITAT_URL_KEY,
  HABITAT_URL_KEY_LEGACY,
  readStoredHabitatUrl,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/frontend/shell-sdk/settings";
import {
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/frontend/shell-sdk/shell-debug-config";

function loadKvScope(scope: SettingsStorageScope): unknown {
  if (scope.kind !== "kv") throw new Error("web 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "habitat") {
    const habitatUrl = readStoredHabitatUrl((k) => localStorage.getItem(k));
    const remoteAuthToken = localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() ?? "";
    if (!habitatUrl && !remoteAuthToken) return null;
    return { habitatUrl, remoteAuthToken };
  }
  if (scopeId === "debug") {
    return parseShellDebugConfig({
      vConsoleEnabled: localStorage.getItem(DEBUG_VCONSOLE_ENABLED_KEY) === "1",
    });
  }
  throw new Error(`未知 kv scope: ${scopeId}`);
}

function saveKvScope(scope: SettingsStorageScope, value: unknown): void {
  if (scope.kind !== "kv") throw new Error("web 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "habitat") {
    const raw = value as { habitatUrl: string; remoteAuthToken: string };
    localStorage.setItem(HABITAT_URL_KEY, raw.habitatUrl);
    localStorage.removeItem(HABITAT_URL_KEY_LEGACY);
    localStorage.setItem(REMOTE_AUTH_TOKEN_KEY, raw.remoteAuthToken);
    return;
  }
  if (scopeId === "debug") {
    const cfg = value as ShellDebugConfig;
    localStorage.setItem(DEBUG_VCONSOLE_ENABLED_KEY, cfg.vConsoleEnabled ? "1" : "0");
    return;
  }
  throw new Error(`未知 kv scope: ${scopeId}`);
}

export function createWebScopedBackend(): ScopedSettingsBackend {
  return {
    load: async (scope) => loadKvScope(scope),
    save: async (scope, value) => {
      saveKvScope(scope, value);
    },
  };
}

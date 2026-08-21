import type { SettingsStorageScope } from "@freeanima/client/portal-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/client/portal-sdk/settings";
import {
  DEBUG_VCONSOLE_ENABLED_KEY,
  HABITAT_URL_KEY,
  readStoredHabitatUrl,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/client/portal-sdk/settings";
import {
  parseShellDebugConfig,
  normalizeShellDebugConfig,
} from "@freeanima/client/portal-sdk/shell-debug-config";
import { normalizeShellClientConfig } from "@freeanima/client/portal-sdk";
import { isRecord } from "@freeanima/shared/util";

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
    if (!isRecord(value)) throw new Error("无效的 habitat 设置");
    const cfg = normalizeShellClientConfig({
      habitatUrl: typeof value.habitatUrl === "string" ? value.habitatUrl : "",
      remoteAuthToken: typeof value.remoteAuthToken === "string" ? value.remoteAuthToken : "",
    });
    localStorage.setItem(HABITAT_URL_KEY, cfg.habitatUrl);
    localStorage.setItem(REMOTE_AUTH_TOKEN_KEY, cfg.remoteAuthToken);
    return;
  }
  if (scopeId === "debug") {
    const cfg = normalizeShellDebugConfig(parseShellDebugConfig(value));
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

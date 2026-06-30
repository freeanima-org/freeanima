import type { SettingsStorageScope } from "@freeanima/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/shell-sdk/settings";
import {
  DEBUG_SENTRY_DSN_KEY,
  DEBUG_SENTRY_ENABLED_KEY,
  DEBUG_VCONSOLE_ENABLED_KEY,
  HUB_URL_KEY,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/shell-sdk/settings";
import {
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/shell-sdk/shell-debug-config";

function loadKvScope(scope: SettingsStorageScope): unknown {
  if (scope.kind !== "kv") throw new Error("web 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "hub") {
    const hubUrl = localStorage.getItem(HUB_URL_KEY)?.trim() ?? "";
    const remoteAuthToken = localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() ?? "";
    if (!hubUrl && !remoteAuthToken) return null;
    return { hubUrl, remoteAuthToken };
  }
  if (scopeId === "debug") {
    return parseShellDebugConfig({
      sentryEnabled: localStorage.getItem(DEBUG_SENTRY_ENABLED_KEY) === "1",
      sentryDsn: localStorage.getItem(DEBUG_SENTRY_DSN_KEY) ?? "",
      vConsoleEnabled: localStorage.getItem(DEBUG_VCONSOLE_ENABLED_KEY) === "1",
    });
  }
  throw new Error(`未知 kv scope: ${scopeId}`);
}

function saveKvScope(scope: SettingsStorageScope, value: unknown): void {
  if (scope.kind !== "kv") throw new Error("web 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "hub") {
    const raw = value as { hubUrl: string; remoteAuthToken: string };
    localStorage.setItem(HUB_URL_KEY, raw.hubUrl);
    localStorage.setItem(REMOTE_AUTH_TOKEN_KEY, raw.remoteAuthToken);
    return;
  }
  if (scopeId === "debug") {
    const cfg = value as ShellDebugConfig;
    localStorage.setItem(DEBUG_SENTRY_ENABLED_KEY, cfg.sentryEnabled ? "1" : "0");
    localStorage.setItem(DEBUG_SENTRY_DSN_KEY, cfg.sentryDsn);
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

export function seedWebHubPrefsIfEmpty(hubUrl: string, remoteAuthToken: string): void {
  if (localStorage.getItem(HUB_URL_KEY)?.trim()) return;
  localStorage.setItem(HUB_URL_KEY, hubUrl.replace(/\/$/, ""));
  localStorage.setItem(REMOTE_AUTH_TOKEN_KEY, remoteAuthToken);
}

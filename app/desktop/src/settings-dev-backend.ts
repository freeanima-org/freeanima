import type { SettingsStorageScope } from "@freeanima/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/shell-sdk/settings";
import {
  DEBUG_SENTRY_DSN_KEY,
  DEBUG_SENTRY_ENABLED_KEY,
  DEBUG_VCONSOLE_ENABLED_KEY,
  HUB_URL_KEY,
  LAUNCH_AT_LOGIN_KEY,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/shell-sdk/settings";
import {
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/shell-sdk/shell-debug-config";

const COMPANION_CONFIG_LS_KEY = "freeanima.companion.config";

function loadKvScope(scope: SettingsStorageScope): unknown {
  if (scope.kind !== "kv") throw new Error("dev backend 不支持 file scope");
  if (scope.id === "hub") {
    const hubUrl = localStorage.getItem(HUB_URL_KEY)?.trim() ?? "";
    const remoteAuthToken = localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() ?? "";
    const launchAtLogin = localStorage.getItem(LAUNCH_AT_LOGIN_KEY) === "1";
    if (!hubUrl && !remoteAuthToken) {
      return { hubUrl: "", remoteAuthToken: "", launchAtLogin };
    }
    return { hubUrl, remoteAuthToken, launchAtLogin };
  }
  if (scope.id === "debug") {
    return parseShellDebugConfig({
      sentryEnabled: localStorage.getItem(DEBUG_SENTRY_ENABLED_KEY) === "1",
      sentryDsn: localStorage.getItem(DEBUG_SENTRY_DSN_KEY) ?? "",
      vConsoleEnabled: localStorage.getItem(DEBUG_VCONSOLE_ENABLED_KEY) === "1",
    });
  }
  throw new Error(`未知 kv scope: ${(scope as SettingsStorageScope).id}`);
}

function saveKvScope(scope: SettingsStorageScope, value: unknown): void {
  if (scope.kind !== "kv") throw new Error("dev backend 不支持 file scope");
  if (scope.id === "hub") {
    const raw = value as { hubUrl: string; remoteAuthToken: string; launchAtLogin?: boolean };
    localStorage.setItem(HUB_URL_KEY, raw.hubUrl);
    localStorage.setItem(REMOTE_AUTH_TOKEN_KEY, raw.remoteAuthToken);
    if (typeof raw.launchAtLogin === "boolean") {
      localStorage.setItem(LAUNCH_AT_LOGIN_KEY, raw.launchAtLogin ? "1" : "0");
    }
    return;
  }
  if (scope.id === "debug") {
    const cfg = value as ShellDebugConfig;
    localStorage.setItem(DEBUG_SENTRY_ENABLED_KEY, cfg.sentryEnabled ? "1" : "0");
    localStorage.setItem(DEBUG_SENTRY_DSN_KEY, cfg.sentryDsn);
    localStorage.setItem(DEBUG_VCONSOLE_ENABLED_KEY, cfg.vConsoleEnabled ? "1" : "0");
    return;
  }
  throw new Error(`未知 kv scope: ${(scope as SettingsStorageScope).id}`);
}

function loadFileScope(scope: SettingsStorageScope): unknown {
  if (scope.kind !== "file" || scope.id !== "companion") {
    throw new Error(`dev backend 不支持 scope: ${JSON.stringify(scope)}`);
  }
  const raw = localStorage.getItem(COMPANION_CONFIG_LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function saveFileScope(scope: SettingsStorageScope, value: unknown): void {
  if (scope.kind !== "file" || scope.id !== "companion") {
    throw new Error(`dev backend 不支持 scope: ${JSON.stringify(scope)}`);
  }
  localStorage.setItem(COMPANION_CONFIG_LS_KEY, JSON.stringify(value, null, 2));
}

/** 浏览器直接打开 desktop Vite 时的 localStorage 回退（Electron preload 未注入时） */
export function createDesktopDevScopedBackend(): ScopedSettingsBackend {
  return {
    load: async (scope) => {
      if (scope.kind === "kv") return loadKvScope(scope);
      return loadFileScope(scope);
    },
    save: async (scope, value) => {
      if (scope.kind === "kv") saveKvScope(scope, value);
      else saveFileScope(scope, value);
    },
  };
}

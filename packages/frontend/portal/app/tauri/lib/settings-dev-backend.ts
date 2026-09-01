import type { SettingsStorageScope } from "@freeanima/client/portal-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/client/portal-sdk/settings";
import {
  COMPANION_VISIBLE_KEY,
  HABITAT_URL_KEY,
  LAUNCH_AT_LOGIN_KEY,
  readStoredHabitatUrl,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/client/portal-sdk/settings";
import { normalizeShellClientConfig } from "@freeanima/client/portal-sdk";
import { isRecord } from "@freeanima/shared/util";

import {
  loadDebugKvFromLocalStorage,
  saveDebugKvToLocalStorage,
} from "../../shared/debug-kv-local-storage.ts";

function loadKvScope(scope: SettingsStorageScope): unknown {
  if (scope.kind !== "kv") throw new Error("dev backend 不支持 file scope");
  if (scope.id === "habitat") {
    const habitatUrl = readStoredHabitatUrl((k) => localStorage.getItem(k));
    const remoteAuthToken = localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() ?? "";
    const launchAtLogin = localStorage.getItem(LAUNCH_AT_LOGIN_KEY) === "1";
    if (!habitatUrl && !remoteAuthToken) {
      return { habitatUrl: "", remoteAuthToken: "", launchAtLogin };
    }
    return { habitatUrl, remoteAuthToken, launchAtLogin };
  }
  if (scope.id === "debug") {
    return loadDebugKvFromLocalStorage();
  }
  if (scope.id === "companion-shell") {
    return { visible: localStorage.getItem(COMPANION_VISIBLE_KEY) !== "0" };
  }
  throw new Error(`未知 kv scope: ${(scope as SettingsStorageScope).id}`);
}

function saveKvScope(scope: SettingsStorageScope, value: unknown): void {
  if (scope.kind !== "kv") throw new Error("dev backend 不支持 file scope");
  if (scope.id === "habitat") {
    if (!isRecord(value)) throw new Error("无效的 habitat 设置");
    const cfg = normalizeShellClientConfig({
      habitatUrl: typeof value.habitatUrl === "string" ? value.habitatUrl : "",
      remoteAuthToken: typeof value.remoteAuthToken === "string" ? value.remoteAuthToken : "",
    });
    localStorage.setItem(HABITAT_URL_KEY, cfg.habitatUrl);
    localStorage.setItem(REMOTE_AUTH_TOKEN_KEY, cfg.remoteAuthToken);
    if (typeof value.launchAtLogin === "boolean") {
      localStorage.setItem(LAUNCH_AT_LOGIN_KEY, value.launchAtLogin ? "1" : "0");
    }
    return;
  }
  if (scope.id === "debug") {
    saveDebugKvToLocalStorage(value);
    return;
  }
  if (scope.id === "companion-shell") {
    const visible = !isRecord(value) || value.visible !== false;
    localStorage.setItem(COMPANION_VISIBLE_KEY, visible ? "1" : "0");
    return;
  }
  throw new Error(`未知 kv scope: ${(scope as SettingsStorageScope).id}`);
}

function loadFileScope(scope: SettingsStorageScope): unknown {
  if (scope.kind !== "file" || scope.id !== "companion") {
    throw new Error(`dev backend 不支持 scope: ${JSON.stringify(scope)}`);
  }
  const raw = localStorage.getItem("freeanima.companion.config");
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
  localStorage.setItem("freeanima.companion.config", JSON.stringify(value, null, 2));
}

/** 浏览器直接打开壳 Vite 时的 localStorage 回退（无 Tauri bridge 时） */
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

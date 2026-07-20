import type { SettingsStorageScope } from "@freeanima/frontend/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/frontend/shell-sdk/settings";
import {
  DEBUG_VCONSOLE_ENABLED_KEY,
  HABITAT_URL_KEY,
  HABITAT_URL_KEY_LEGACY,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/frontend/shell-sdk/settings";
import { parseShellDebugConfig, type ShellDebugConfig } from "@freeanima/frontend/shell-sdk";

import { applyMobileDebugConsole } from "./debug-console.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";
import { readShellSnapshot } from "./mobile-shell.ts";

function loadHabitatConfigFromShellSnapshot(): {
  habitatUrl: string;
  remoteAuthToken: string;
} | null {
  const snapshot = readShellSnapshot();
  if (!snapshot?.habitatUrl?.trim()) return null;
  return {
    habitatUrl: snapshot.habitatUrl.trim(),
    remoteAuthToken: snapshot.remoteAuthToken?.trim() ?? "",
  };
}

function loadHabitatConfigFromSatelliteShell(): {
  habitatUrl: string;
  remoteAuthToken: string;
} | null {
  const shell = window.satelliteShell;
  const habitatUrl = shell?.habitatUrl?.trim();
  if (!habitatUrl) return null;
  return {
    habitatUrl,
    remoteAuthToken: shell?.remoteAuth?.token?.trim() ?? "",
  };
}

async function loadKvScope(scope: SettingsStorageScope): Promise<unknown> {
  if (scope.kind !== "kv") throw new Error("mobile 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "habitat") {
    const shellFallback =
      loadHabitatConfigFromSatelliteShell() ?? loadHabitatConfigFromShellSnapshot();
    try {
      const [habitatUrl, habitatUrlLegacy, remoteAuthToken] = await Promise.all([
        prefsGet({ key: HABITAT_URL_KEY }, 2_000),
        prefsGet({ key: HABITAT_URL_KEY_LEGACY }, 2_000),
        prefsGet({ key: REMOTE_AUTH_TOKEN_KEY }, 2_000),
      ]);
      const url = habitatUrl.value?.trim() || habitatUrlLegacy.value?.trim() || "";
      if (url || remoteAuthToken.value) {
        return { habitatUrl: url, remoteAuthToken: remoteAuthToken.value ?? "" };
      }
    } catch {
      /* 远程栖息地页 Preferences 可能尚未就绪，回退 shell-bridge 注入 */
    }
    return shellFallback ?? null;
  }
  if (scope.id === "debug") {
    const vConsole = await prefsGet({ key: DEBUG_VCONSOLE_ENABLED_KEY });
    return parseShellDebugConfig({
      vConsoleEnabled: vConsole.value === "1",
    });
  }
  throw new Error(`未知 kv scope: ${scopeId}`);
}

async function saveKvScope(scope: SettingsStorageScope, value: unknown): Promise<void> {
  if (scope.kind !== "kv") throw new Error("mobile 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "habitat") {
    const raw = value as { habitatUrl: string; remoteAuthToken: string };
    await prefsSet({ key: HABITAT_URL_KEY, value: raw.habitatUrl });
    await prefsSet({ key: HABITAT_URL_KEY_LEGACY, value: "" });
    await prefsSet({ key: REMOTE_AUTH_TOKEN_KEY, value: raw.remoteAuthToken });
    return;
  }
  if (scope.id === "debug") {
    const cfg = value as ShellDebugConfig;
    await prefsSet({
      key: DEBUG_VCONSOLE_ENABLED_KEY,
      value: cfg.vConsoleEnabled ? "1" : "0",
    });
    await applyMobileDebugConsole(cfg.vConsoleEnabled);
    return;
  }
  throw new Error(`未知 kv scope: ${scopeId}`);
}

export function createMobileScopedBackend(): ScopedSettingsBackend {
  return {
    load: loadKvScope,
    save: saveKvScope,
  };
}

export async function testMobileHabitatConnection(value: {
  habitatUrl: string;
  remoteAuthToken: string;
}): Promise<void> {
  const { testHabitatConnection } = await import("./mobile-shell.ts");
  await testHabitatConnection(value.habitatUrl, value.remoteAuthToken);
}

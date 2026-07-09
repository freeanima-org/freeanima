import type { SettingsStorageScope } from "@freeanima/frontend/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/frontend/shell-sdk/settings";
import {
  DEBUG_VCONSOLE_ENABLED_KEY,
  HUB_URL_KEY,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/frontend/shell-sdk/settings";
import { parseShellDebugConfig, type ShellDebugConfig } from "@freeanima/frontend/shell-sdk";

import { applyMobileDebugConsole } from "./debug-console.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";
import { readShellSnapshot } from "./mobile-shell.ts";

function loadHubConfigFromShellSnapshot(): { hubUrl: string; remoteAuthToken: string } | null {
  const snapshot = readShellSnapshot();
  if (!snapshot?.hubUrl?.trim()) return null;
  return {
    hubUrl: snapshot.hubUrl.trim(),
    remoteAuthToken: snapshot.remoteAuthToken?.trim() ?? "",
  };
}

function loadHubConfigFromSatelliteShell(): { hubUrl: string; remoteAuthToken: string } | null {
  const shell = window.satelliteShell;
  const hubUrl = shell?.hubUrl?.trim();
  if (!hubUrl) return null;
  return {
    hubUrl,
    remoteAuthToken: shell?.remoteAuth?.token?.trim() ?? "",
  };
}

async function loadKvScope(scope: SettingsStorageScope): Promise<unknown> {
  if (scope.kind !== "kv") throw new Error("mobile 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "hub") {
    const shellFallback = loadHubConfigFromSatelliteShell() ?? loadHubConfigFromShellSnapshot();
    try {
      const [hubUrl, remoteAuthToken] = await Promise.all([
        prefsGet({ key: HUB_URL_KEY }, 2_000),
        prefsGet({ key: REMOTE_AUTH_TOKEN_KEY }, 2_000),
      ]);
      if (hubUrl.value || remoteAuthToken.value) {
        return { hubUrl: hubUrl.value ?? "", remoteAuthToken: remoteAuthToken.value ?? "" };
      }
    } catch {
      /* 远程 Hub 页 Preferences 可能尚未就绪，回退 shell-bridge 注入 */
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
  if (scopeId === "hub") {
    const raw = value as { hubUrl: string; remoteAuthToken: string };
    await prefsSet({ key: HUB_URL_KEY, value: raw.hubUrl });
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

export async function testMobileHubConnection(value: {
  hubUrl: string;
  remoteAuthToken: string;
}): Promise<void> {
  const { testHubConnection } = await import("./mobile-shell.ts");
  await testHubConnection(value.hubUrl, value.remoteAuthToken);
}

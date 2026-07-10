import { ipcMain } from "electron";

import { resolveHubRpcWsUrl } from "@freeanima/shared/hub-rpc";
import { testHubHealthConnection } from "@freeanima/frontend/shell-sdk";
import type { SettingsStorageScope } from "@freeanima/frontend/shell-sdk/settings";
import {
  COMPANION_CONFIG_SCOPE,
  COMPANION_SHELL_SCOPE,
  DEBUG_SETTINGS_SCOPE,
  HUB_SETTINGS_SCOPE,
} from "@freeanima/frontend/shell-sdk/settings";

import { readShellClientConfig, writeShellClientConfig } from "./shell-client-store.ts";
import { readShellDebugConfig, writeShellDebugConfig } from "./shell-debug-store.ts";
import { setLaunchAtLogin } from "./launch-at-login.ts";
import {
  loadCompanionConfigFromFile,
  readCompanionVisibleFromStore,
  readLaunchAtLoginFromStore,
  saveCompanionConfigToFile,
  saveCompanionVisibleToStore,
} from "./shell-scoped-prefs.ts";

export type HubClientConfigPayload = {
  hubUrl: string;
  hubWsUrl: string;
  remoteAuthToken: string;
};

type HubSettingsPayload = {
  hubUrl: string;
  remoteAuthToken: string;
  launchAtLogin?: boolean;
};

function loadHubSettingsPayload(): HubSettingsPayload | null {
  const cfg = readShellClientConfig();
  if (!cfg) {
    return { hubUrl: "", remoteAuthToken: "", launchAtLogin: readLaunchAtLoginFromStore() };
  }
  return { ...cfg, launchAtLogin: readLaunchAtLoginFromStore() };
}

export function resolveHubClientConfig(): HubClientConfigPayload | null {
  const cfg = readShellClientConfig();
  if (!cfg) return null;
  return {
    hubUrl: cfg.hubUrl,
    hubWsUrl: resolveHubRpcWsUrl(cfg.hubUrl),
    remoteAuthToken: cfg.remoteAuthToken,
  };
}

function assertScope(expected: SettingsStorageScope, actual: SettingsStorageScope): void {
  if (expected.kind !== actual.kind || expected.id !== actual.id) {
    throw new Error(`settings scope 不匹配: 期望 ${expected.id}，收到 ${actual.id}`);
  }
}

export function registerShellClientIpc(
  showHubSettings: () => void,
  onConfigSaved?: () => void,
  onCompanionVisibleSaved?: (visible: boolean) => void,
): void {
  ipcMain.handle("shell:settings:load", (_event, scope: SettingsStorageScope) => {
    if (scope.kind === "kv" && scope.id === "hub") {
      assertScope(HUB_SETTINGS_SCOPE, scope);
      return loadHubSettingsPayload();
    }
    if (scope.kind === "kv" && scope.id === "debug") {
      assertScope(DEBUG_SETTINGS_SCOPE, scope);
      return readShellDebugConfig();
    }
    if (scope.kind === "kv" && scope.id === "companion-shell") {
      assertScope(COMPANION_SHELL_SCOPE, scope);
      return { visible: readCompanionVisibleFromStore() };
    }
    if (scope.kind === "file" && scope.id === "companion") {
      assertScope(COMPANION_CONFIG_SCOPE, scope);
      return loadCompanionConfigFromFile();
    }
    throw new Error(`未知 settings scope: ${JSON.stringify(scope)}`);
  });

  ipcMain.handle("shell:settings:save", (_event, scope: SettingsStorageScope, value: unknown) => {
    if (scope.kind === "kv" && scope.id === "hub") {
      assertScope(HUB_SETTINGS_SCOPE, scope);
      const raw = value as HubSettingsPayload;
      writeShellClientConfig({ hubUrl: raw.hubUrl, remoteAuthToken: raw.remoteAuthToken });
      if (typeof raw.launchAtLogin === "boolean") {
        setLaunchAtLogin(raw.launchAtLogin);
      }
      onConfigSaved?.();
      return loadHubSettingsPayload();
    }
    if (scope.kind === "kv" && scope.id === "debug") {
      assertScope(DEBUG_SETTINGS_SCOPE, scope);
      return writeShellDebugConfig(
        value as import("@freeanima/frontend/shell-sdk").ShellDebugConfig,
      );
    }
    if (scope.kind === "kv" && scope.id === "companion-shell") {
      assertScope(COMPANION_SHELL_SCOPE, scope);
      const raw = value as { visible?: boolean };
      const visible = raw.visible !== false;
      saveCompanionVisibleToStore(visible);
      onCompanionVisibleSaved?.(visible);
      return { visible };
    }
    if (scope.kind === "file" && scope.id === "companion") {
      assertScope(COMPANION_CONFIG_SCOPE, scope);
      saveCompanionConfigToFile(value);
      return loadCompanionConfigFromFile();
    }
    throw new Error(`未知 settings scope: ${JSON.stringify(scope)}`);
  });

  ipcMain.handle(
    "shell:settings:test",
    async (_event, scope: SettingsStorageScope, value: unknown) => {
      if (scope.kind === "kv" && scope.id === "hub") {
        assertScope(HUB_SETTINGS_SCOPE, scope);
        const raw = value as { hubUrl: string; remoteAuthToken: string };
        const hubUrl = String(raw.hubUrl ?? "")
          .trim()
          .replace(/\/$/, "");
        const token = String(raw.remoteAuthToken ?? "").trim();
        if (!hubUrl) throw new Error("Hub 地址不能为空");
        await testHubHealthConnection(hubUrl, token || undefined);
        return true;
      }
      throw new Error(`scope ${scope.id} 不支持 test`);
    },
  );

  ipcMain.handle("shell:get-client-config", () => resolveHubClientConfig());

  ipcMain.on("shell:get-client-config-sync", (event) => {
    event.returnValue = resolveHubClientConfig();
  });

  ipcMain.handle("shell:open-settings", () => {
    showHubSettings();
  });
}

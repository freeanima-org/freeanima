import { ipcMain } from "electron";
import { join } from "node:path";

import { resolveHubWsUrl } from "@freeanima/sap-contract";
import { testHubHealthConnection } from "@freeanima/satellite-sdk";

import { readShellClientConfig, writeShellClientConfig } from "./shell-client-store.ts";
import { readShellDebugConfig, writeShellDebugConfig } from "./shell-debug-store.ts";

export type HubClientConfigPayload = {
  hubUrl: string;
  hubWsUrl: string;
  remoteAuthToken: string;
};

export function resolveHubClientConfig(): HubClientConfigPayload | null {
  const cfg = readShellClientConfig();
  if (!cfg) return null;
  return {
    hubUrl: cfg.hubUrl,
    hubWsUrl: resolveHubWsUrl(cfg.hubUrl),
    remoteAuthToken: cfg.remoteAuthToken,
  };
}

export function registerShellClientIpc(
  showHubSettings: () => void,
  onConfigSaved?: () => void,
): void {
  ipcMain.handle("shell:get-client-config", () => resolveHubClientConfig());

  ipcMain.handle(
    "shell:save-client-config",
    (_event, raw: { hubUrl: string; remoteAuthToken: string }) => {
      writeShellClientConfig({
        hubUrl: String(raw.hubUrl ?? ""),
        remoteAuthToken: String(raw.remoteAuthToken ?? ""),
      });
      onConfigSaved?.();
      return resolveHubClientConfig();
    },
  );

  ipcMain.handle(
    "shell:test-hub-connection",
    async (_event, raw: { hubUrl: string; remoteAuthToken: string }) => {
      const hubUrl = String(raw.hubUrl ?? "")
        .trim()
        .replace(/\/$/, "");
      const token = String(raw.remoteAuthToken ?? "").trim();
      if (!hubUrl) throw new Error("Hub 地址不能为空");
      await testHubHealthConnection(hubUrl, token || undefined);
      return true;
    },
  );

  ipcMain.handle("shell:show-hub-settings", () => {
    showHubSettings();
  });

  ipcMain.handle("shell:open-settings", () => {
    showHubSettings();
  });

  ipcMain.handle("shell:get-debug-config", () => readShellDebugConfig());

  ipcMain.handle(
    "shell:save-debug-config",
    (_event, raw: import("@freeanima/satellite-sdk").ShellDebugConfig) => {
      return writeShellDebugConfig(raw);
    },
  );
}

export function hubSettingsDir(): string {
  return join(import.meta.dirname, "..", "hub-settings");
}

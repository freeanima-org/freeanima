import { browserSapInstanceStore } from "@freeanima/shared/sap-contract";
import { resolveHubWsUrl } from "@freeanima/shared/sap-contract/urls";
import { testHubHealthConnection } from "@freeanima/frontend/shell-sdk";
import { buildShellApiFields } from "@freeanima/frontend/shell-sdk/shell-api-fields";
import type { SatelliteShellApi } from "@freeanima/frontend/shell-sdk/shell-api";
import { parseShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config";
import type { SettingsStorageScope } from "@freeanima/frontend/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/frontend/shell-sdk/settings";
import { HUB_SETTINGS_SCOPE } from "@freeanima/frontend/shell-sdk/settings";
import { sendSentryTestEvent } from "@freeanima/frontend/shell-ui/lib/sentry-test.ts";

import { createDesktopDevScopedBackend } from "./settings-dev-backend.ts";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
};

type ScopedSettingsBridge = ScopedSettingsBackend & {
  test(scope: SettingsStorageScope, value: unknown): Promise<unknown>;
};

declare global {
  interface Window {
    freeanimaScopedSettings?: ScopedSettingsBridge;
  }
}

function installShellBridgeReady(): () => void {
  const w = window as ShellBridgeWindow;
  if (w.__freeanimaShellBridge?.ready) {
    return () => {};
  }
  let resolveReady!: () => void;
  w.__freeanimaShellBridge = {
    ready: new Promise<void>((resolve) => {
      resolveReady = resolve;
    }),
  };
  return resolveReady;
}

function installDevScopedSettingsBridge(): void {
  const backend = createDesktopDevScopedBackend();
  window.freeanimaScopedSettings = {
    load: (scope) => backend.load(scope),
    save: async (scope, value) => {
      await backend.save(scope, value);
    },
    test: async (scope, value) => {
      if (scope.kind === "kv" && scope.id === "hub") {
        const raw = value as { hubUrl: string; remoteAuthToken: string };
        const hubUrl = String(raw.hubUrl ?? "")
          .trim()
          .replace(/\/$/, "");
        const token = String(raw.remoteAuthToken ?? "").trim();
        if (!hubUrl) throw new Error("Hub 地址不能为空");
        await testHubHealthConnection(hubUrl, token || undefined);
        return;
      }
      if (scope.kind === "kv" && scope.id === "debug") {
        await backend.save(scope, value);
        await sendSentryTestEvent();
        return;
      }
    },
  };
}

function createBrowserDevShellStub(hubUrl = "", remoteAuthToken = ""): SatelliteShellApi {
  const trimmedHub = hubUrl.replace(/\/$/, "");
  const hubWsUrl = trimmedHub ? resolveHubWsUrl(trimmedHub) : "";
  const apiFields = trimmedHub
    ? buildShellApiFields(trimmedHub, hubWsUrl, remoteAuthToken)
    : { hubUrl: "", hubWsUrl: "" };

  const shell: SatelliteShellApi = {
    isElectron: false,
    windowRole: null,
    apiOrigin: null,
    hubUrl: apiFields.hubUrl,
    hubWsUrl: apiFields.hubWsUrl,
    createFileInstanceStore: (appId) =>
      browserSapInstanceStore(trimmedHub || "http://127.0.0.1:2658", appId),
    emitConfigChanged: async () => {},
    listenConfigChanged: () => () => {},
  };
  if (apiFields.remoteAuth !== undefined) shell.remoteAuth = apiFields.remoteAuth;
  if (apiFields.hubFetch !== undefined) shell.hubFetch = apiFields.hubFetch;
  return shell;
}

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.shellUi = "1";

  if (!window.freeanimaScopedSettings) {
    installDevScopedSettingsBridge();
  }

  if (!window.satelliteShell) {
    window.satelliteShell = createBrowserDevShellStub();
    try {
      const backend = createDesktopDevScopedBackend();
      const raw = await backend.load(HUB_SETTINGS_SCOPE);
      const parsed = parseShellClientConfig(raw);
      if (parsed?.hubUrl) {
        window.satelliteShell = createBrowserDevShellStub(parsed.hubUrl, parsed.remoteAuthToken);
      }
    } catch {
      /* 开发回退：Hub 未配置时保留 stub */
    }
  }

  finish();
}

void bootstrapShellBridge().catch((err) => {
  console.error("[desktop shell-bridge]", err);
});

export const DESKTOP_SHELL_BRIDGE_MODULE = true;

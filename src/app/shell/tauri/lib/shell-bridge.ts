import { browserRemoteInstanceStore } from "@freeanima/shared/rpc-contract";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import { testHabitatHealthConnection } from "@freeanima/frontend/shell-sdk";
import { buildShellApiFields } from "@freeanima/frontend/shell-sdk/shell-api-fields";
import type { ShellApi } from "@freeanima/frontend/shell-sdk/shell-api";
import { parseShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config";
import type { SettingsStorageScope } from "@freeanima/frontend/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/frontend/shell-sdk/settings";
import { HABITAT_SETTINGS_SCOPE } from "@freeanima/frontend/shell-sdk/settings";

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
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as { habitatUrl: string; remoteAuthToken: string };
        const habitatUrl = String(raw.habitatUrl ?? "")
          .trim()
          .replace(/\/$/, "");
        const token = String(raw.remoteAuthToken ?? "").trim();
        if (!habitatUrl) throw new Error("栖息地地址不能为空");
        await testHabitatHealthConnection(habitatUrl, token || undefined);
        return;
      }
      if (scope.kind === "kv" && scope.id === "debug") {
        await backend.save(scope, value);
        return;
      }
    },
  };
}

function createBrowserDevShellStub(habitatUrl = "", remoteAuthToken = ""): ShellApi {
  const trimmedHabitatUrl = habitatUrl.replace(/\/$/, "");
  const habitatWsUrl = trimmedHabitatUrl ? resolveHabitatRpcWsUrl(trimmedHabitatUrl) : "";
  const apiFields = trimmedHabitatUrl
    ? buildShellApiFields(trimmedHabitatUrl, habitatWsUrl, remoteAuthToken)
    : { habitatUrl: "", habitatWsUrl: "" };

  const shell: ShellApi = {
    windowRole: null,
    apiOrigin: null,
    habitatUrl: apiFields.habitatUrl,
    habitatWsUrl: apiFields.habitatWsUrl,
    createFileInstanceStore: (appId) =>
      browserRemoteInstanceStore(trimmedHabitatUrl || "http://127.0.0.1:2658", appId),
    emitConfigChanged: async () => {},
    listenConfigChanged: () => () => {},
  };
  if (apiFields.remoteAuth !== undefined) shell.remoteAuth = apiFields.remoteAuth;
  if (apiFields.habitatFetch !== undefined) shell.habitatFetch = apiFields.habitatFetch;
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
      const raw = await backend.load(HABITAT_SETTINGS_SCOPE);
      const parsed = parseShellClientConfig(raw);
      if (parsed?.habitatUrl) {
        window.satelliteShell = createBrowserDevShellStub(
          parsed.habitatUrl,
          parsed.remoteAuthToken,
        );
      }
    } catch {
      /* 开发回退：Habitat 未配置时保留 stub */
    }
  }

  finish();
}

void bootstrapShellBridge().catch((err) => {
  console.error("[desktop shell-bridge]", err);
});

export const DESKTOP_SHELL_BRIDGE_MODULE = true;

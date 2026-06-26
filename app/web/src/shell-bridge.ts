import { parseShellClientConfig } from "@freeanima/satellite-sdk";
import type { SettingsStorageScope } from "@freeanima/satellite-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/satellite-sdk/settings";
import { HUB_SETTINGS_SCOPE } from "@freeanima/satellite-sdk/settings";

import {
  createWebScopedBackend,
  seedWebHubPrefsIfEmpty,
} from "./settings-local-backend.ts";
import {
  buildWebShellFromRaw,
  createWebShellStub,
  installWebShellFromPrefs,
  testWebHubConnection,
} from "./web-shell.ts";

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

declare global {
  const __WEB_DEFAULT_HUB_URL__: string;
  const __WEB_DEFAULT_REMOTE_AUTH_TOKEN__: string;
}

function installShellBridgeReady(): () => void {
  let resolveReady!: () => void;
  (window as ShellBridgeWindow).__freeanimaShellBridge = {
    ready: new Promise<void>((resolve) => {
      resolveReady = resolve;
    }),
  };
  return resolveReady;
}

function installScopedSettingsBridge(): void {
  const backend = createWebScopedBackend();
  window.freeanimaScopedSettings = {
    load: (scope: SettingsStorageScope) => backend.load(scope),
    save: async (scope: SettingsStorageScope, value: unknown) => {
      await backend.save(scope, value);
    },
    test: async (scope: SettingsStorageScope, value: unknown): Promise<unknown> => {
      if (scope.kind === "kv" && scope.id === "hub") {
        const raw = value as { hubUrl: string; remoteAuthToken: string };
        await testWebHubConnection(raw.hubUrl, raw.remoteAuthToken);
        return;
      }
      if (scope.kind === "kv" && scope.id === "debug") {
        await backend.save(scope, value);
        const { sendSentryTestEvent } = await import("@freeanima/shell-ui/sentry-test");
        await sendSentryTestEvent();
      }
    },
  };
}

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.shellUi = "1";
  installScopedSettingsBridge();
  window.satelliteShell = createWebShellStub();

  try {
    const defaultHubUrl = (__WEB_DEFAULT_HUB_URL__ || "http://127.0.0.1:2658").replace(/\/$/, "");
    const defaultToken = __WEB_DEFAULT_REMOTE_AUTH_TOKEN__ || "";
    seedWebHubPrefsIfEmpty(defaultHubUrl, defaultToken);

    const backend = createWebScopedBackend();
    const raw = await backend.load(HUB_SETTINGS_SCOPE);
    const parsed = parseShellClientConfig(raw);
    if (parsed) {
      installWebShellFromPrefs(parsed.hubUrl, parsed.remoteAuthToken);
    } else if (defaultHubUrl) {
      window.satelliteShell = buildWebShellFromRaw(defaultHubUrl, defaultToken);
    }
  } finally {
    finish();
  }
}

void bootstrapShellBridge().catch((err) => {
  console.error("[shell-bridge]", err);
});

export const WEB_SHELL_BRIDGE_MODULE = true;

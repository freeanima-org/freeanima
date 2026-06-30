import { parseShellClientConfig } from "@freeanima/shell-sdk/shell-client-config";
import type { SettingsStorageScope } from "@freeanima/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/shell-sdk/settings";
import { HUB_SETTINGS_SCOPE } from "@freeanima/shell-sdk/settings";

import { createWebScopedBackend, seedWebHubPrefsIfEmpty } from "./settings-local-backend.ts";
import {
  buildWebShellFromRaw,
  createWebShellStub,
  installWebShellFromPrefs,
  testWebHubConnection,
  webNeedsHubSetupFromConfig,
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
        return;
      }
      return;
    },
  };
}

function redirectToHubSetupIfNeeded(): void {
  if (!webNeedsHubSetupFromConfig()) return;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const setupPath = base ? `${base}/setup` : "/setup";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === setupPath || path.endsWith("/setup")) return;
  const next = `${setupPath}${window.location.search}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.shellUi = "1";
  installScopedSettingsBridge();
  window.satelliteShell = createWebShellStub();

  try {
    let defaultHubUrl = (__WEB_DEFAULT_HUB_URL__ || "http://127.0.0.1:2658").replace(/\/$/, "");
    const defaultToken = __WEB_DEFAULT_REMOTE_AUTH_TOKEN__ || "";

    try {
      const configPath = `${import.meta.env.BASE_URL}config.json`.replace(/\/{2,}/g, "/");
      const res = await fetch(configPath, { cache: "no-store" });
      if (res.ok) {
        const cfg = (await res.json()) as { hub_url?: string };
        const runtimeHub = cfg.hub_url?.trim().replace(/\/$/, "");
        if (runtimeHub) defaultHubUrl = runtimeHub;
      }
    } catch {
      /* 无 /config.json 时使用构建默认值 */
    }

    seedWebHubPrefsIfEmpty(defaultHubUrl, defaultToken);

    const backend = createWebScopedBackend();
    const raw = await backend.load(HUB_SETTINGS_SCOPE);
    const parsed = parseShellClientConfig(raw);
    if (parsed) {
      installWebShellFromPrefs(parsed.hubUrl, parsed.remoteAuthToken);
    } else if (defaultHubUrl) {
      window.satelliteShell = buildWebShellFromRaw(defaultHubUrl, defaultToken);
    }

    redirectToHubSetupIfNeeded();
  } finally {
    finish();
  }
}

void bootstrapShellBridge().catch((err) => {
  console.error("[shell-bridge]", err);
});

export const WEB_SHELL_BRIDGE_MODULE = true;

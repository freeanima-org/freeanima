import { parseShellClientConfig } from "@freeanima/shell-sdk/shell-client-config";
import type { SettingsStorageScope } from "@freeanima/shell-sdk/settings";
import { HUB_SETTINGS_SCOPE } from "@freeanima/shell-sdk/settings";

import { createWebScopedBackend, seedWebHubPrefsIfEmpty } from "../settings-local-backend.ts";
import {
  buildWebShellFromRaw,
  createWebShellStub,
  installWebShellFromPrefs,
  testWebHubConnection,
  webNeedsHubSetupFromConfig,
} from "../web-shell.ts";

import type { ScopedSettingsBridge } from "./shared.ts";

function installScopedSettingsBridge(): void {
  if (window.freeanimaScopedSettings) return;
  const backend = createWebScopedBackend();
  const bridge: ScopedSettingsBridge = {
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
  window.freeanimaScopedSettings = bridge;
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

export async function bootstrapElectronBridge(
  defaultHubUrl: string,
  defaultToken: string,
): Promise<void> {
  if (window.satelliteShell?.isElectron) return;
  window.satelliteShell = createWebShellStub();
  if (!window.freeanimaScopedSettings) installScopedSettingsBridge();
  const backend = createWebScopedBackend();
  const raw = await backend.load(HUB_SETTINGS_SCOPE);
  const parsed = parseShellClientConfig(raw);
  if (parsed) {
    installWebShellFromPrefs(parsed.hubUrl, parsed.remoteAuthToken);
  } else if (defaultHubUrl) {
    window.satelliteShell = buildWebShellFromRaw(defaultHubUrl, defaultToken);
  }
}

export async function bootstrapWebBridge(
  defaultHubUrl: string,
  defaultToken: string,
): Promise<void> {
  installScopedSettingsBridge();
  window.satelliteShell = createWebShellStub();
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
}

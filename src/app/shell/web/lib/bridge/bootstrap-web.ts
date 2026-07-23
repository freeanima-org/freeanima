import { parseShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config";
import type { SettingsStorageScope } from "@freeanima/frontend/shell-sdk/settings";
import { HABITAT_SETTINGS_SCOPE } from "@freeanima/frontend/shell-sdk/settings";

import { createWebScopedBackend } from "../settings-local-backend.ts";
import {
  buildWebShellFromRaw,
  createWebShellStub,
  installWebShellFromPrefs,
  testWebHabitatConnection,
  webNeedsHubSetupFromConfig,
} from "../web-shell.ts";

import type { ScopedSettingsBridge } from "./shared.ts";

export type BootstrapWebBridgeOptions = {
  sameOrigin?: boolean;
  remoteAuthToken?: string;
};

function installScopedSettingsBridge(): void {
  if (window.freeanimaScopedSettings) return;
  const backend = createWebScopedBackend();
  const bridge: ScopedSettingsBridge = {
    load: (scope: SettingsStorageScope) => backend.load(scope),
    save: async (scope: SettingsStorageScope, value: unknown) => {
      await backend.save(scope, value);
    },
    test: async (scope: SettingsStorageScope, value: unknown): Promise<unknown> => {
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as { habitatUrl: string; remoteAuthToken: string };
        await testWebHabitatConnection(raw.habitatUrl, raw.remoteAuthToken);
        return;
      }
      if (scope.kind === "kv" && scope.id === "debug") {
        await backend.save(scope, value);
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
  const settingsPath = base ? `${base}/settings` : "/settings";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === settingsPath || path.endsWith("/settings")) return;
  const next = `${settingsPath}${window.location.search}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}

export async function bootstrapWebBridge(
  defaultHubUrl: string,
  options?: BootstrapWebBridgeOptions,
): Promise<void> {
  installScopedSettingsBridge();
  window.portalShell = createWebShellStub();
  const backend = createWebScopedBackend();
  const raw = await backend.load(HABITAT_SETTINGS_SCOPE);
  const parsed = parseShellClientConfig(raw);
  const pageOrigin = window.location.origin.replace(/\/$/, "");
  const sameOrigin = options?.sameOrigin !== false;
  const autoToken = options?.remoteAuthToken?.trim() ?? "";
  const prefsToken = parsed?.remoteAuthToken?.trim() ?? "";

  if (sameOrigin) {
    const habitatUrl = (defaultHubUrl || pageOrigin).replace(/\/$/, "");
    const token = prefsToken || autoToken;
    if (habitatUrl) {
      installWebShellFromPrefs(habitatUrl, token);
      if (autoToken && !prefsToken) {
        await backend.save(HABITAT_SETTINGS_SCOPE, {
          habitatUrl,
          remoteAuthToken: autoToken,
        });
      }
    }
  } else if (parsed) {
    installWebShellFromPrefs(parsed.habitatUrl, parsed.remoteAuthToken);
  } else if (defaultHubUrl) {
    window.portalShell = buildWebShellFromRaw(defaultHubUrl, prefsToken || autoToken);
  }

  redirectToHubSetupIfNeeded();
  if (window.portalShell?.remoteAuth?.token?.trim()) {
    window.dispatchEvent(new CustomEvent("freeanima:shell-config-changed"));
  }
}

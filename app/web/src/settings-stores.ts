import {
  createScopedSettingsStore,
  DEBUG_SETTINGS_SCOPE,
  HUB_SETTINGS_SCOPE,
  type SettingsStore,
} from "@freeanima/satellite-sdk/settings";
import {
  normalizeShellClientConfig,
  parseShellClientConfig,
  type ShellClientConfig,
} from "@freeanima/satellite-sdk/shell-client-config";
import {
  DEFAULT_SHELL_DEBUG,
  normalizeShellDebugConfig,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/satellite-sdk/shell-debug-config";

import { createWebScopedBackend } from "./settings-local-backend.ts";
import {
  installWebShellFromPrefs,
  SHELL_CONFIG_CHANGED_EVENT,
  testWebHubConnection,
} from "./web-shell.ts";

export type WebSettingsStores = {
  hub: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
};

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

export function createWebSettingsStores(): WebSettingsStores {
  const backend = createWebScopedBackend();
  const hubBase = createScopedSettingsStore<ShellClientConfig>({
    scope: HUB_SETTINGS_SCOPE,
    backend,
    parseLoad(raw) {
      if (raw == null) return { hubUrl: "", remoteAuthToken: "" };
      const parsed = parseShellClientConfig(raw);
      if (!parsed) return { hubUrl: "", remoteAuthToken: "" };
      return parsed;
    },
    normalizeSave: normalizeShellClientConfig,
    async test(value) {
      await testWebHubConnection(value.hubUrl, value.remoteAuthToken);
    },
  });
  const hub: SettingsStore<ShellClientConfig> = {
    scope: hubBase.scope,
    load: () => hubBase.load(),
    test: (value) => hubBase.test!(value),
    async save(value) {
      const normalized = normalizeShellClientConfig(value);
      await backend.save(HUB_SETTINGS_SCOPE, normalized);
      installWebShellFromPrefs(normalized.hubUrl, normalized.remoteAuthToken);
      notifyShellConfigChanged();
    },
  };
  const debugBase = createScopedSettingsStore<ShellDebugConfig>({
    scope: DEBUG_SETTINGS_SCOPE,
    backend,
    parseLoad(raw) {
      return parseShellDebugConfig(raw ?? DEFAULT_SHELL_DEBUG);
    },
    normalizeSave: normalizeShellDebugConfig,
  });
  const debug: SettingsStore<ShellDebugConfig> = {
    scope: debugBase.scope,
    load: () => debugBase.load(),
    async save(value) {
      await debugBase.save(value);
    },
    async test(value) {
      const normalized = normalizeShellDebugConfig(value);
      await debugBase.save(normalized);
      const { sendSentryTestEvent } = await import("@freeanima/shell-ui/sentry-test");
      await sendSentryTestEvent();
    },
  };
  return { hub, debug };
}

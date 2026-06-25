import {
  createScopedSettingsStore,
  DEBUG_SETTINGS_SCOPE,
  HUB_SETTINGS_SCOPE,
  type SettingsStore,
} from "@freeanima/satellite-sdk/settings";
import {
  DEFAULT_SHELL_DEBUG,
  normalizeShellClientConfig,
  normalizeShellDebugConfig,
  parseShellClientConfig,
  parseShellDebugConfig,
  type ShellClientConfig,
  type ShellDebugConfig,
} from "@freeanima/satellite-sdk";

import { buildMobileShell, SHELL_CONFIG_CHANGED_EVENT } from "./mobile-shell.ts";
import { createMobileScopedBackend, testMobileHubConnection } from "./settings-prefs-backend.ts";
import { DEBUG_CONFIG_CHANGED_EVENT } from "./shell-bridge.ts";

export type MobileSettingsStores = {
  hub: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
};

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

function notifyDebugConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
}

export function createMobileSettingsStores(): MobileSettingsStores {
  const backend = createMobileScopedBackend();
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
      await testMobileHubConnection(value);
    },
  });
  const hub: SettingsStore<ShellClientConfig> = {
    scope: hubBase.scope,
    load: () => hubBase.load(),
    test: (value) => hubBase.test!(value),
    async save(value) {
      const normalized = normalizeShellClientConfig(value);
      await backend.save(HUB_SETTINGS_SCOPE, normalized);
      window.satelliteShell = await buildMobileShell(normalized.hubUrl, normalized.remoteAuthToken);
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
      notifyDebugConfigChanged();
    },
    async test(value) {
      const normalized = normalizeShellDebugConfig(value);
      await debugBase.save(normalized);
      notifyDebugConfigChanged();
      const { sendSentryTestEvent } = await import("@freeanima/shell-ui/sentry-test");
      await sendSentryTestEvent();
    },
  };
  return { hub, debug };
}

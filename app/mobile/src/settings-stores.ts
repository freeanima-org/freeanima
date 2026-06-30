import {
  createDebugSettingsStore,
  createHubSettingsStore,
  HUB_SETTINGS_SCOPE,
  type SettingsStore,
} from "@freeanima/shell-sdk/settings";
import {
  normalizeShellClientConfig,
  type ShellClientConfig,
  type ShellDebugConfig,
} from "@freeanima/shell-sdk";
import { sendSentryTestEvent } from "@freeanima/shell-ui/sentry-test";
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
  const hubBase = createHubSettingsStore(backend, {
    test: testMobileHubConnection,
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
  const debugBase = createDebugSettingsStore(backend);
  const debug: SettingsStore<ShellDebugConfig> = {
    scope: debugBase.scope,
    load: () => debugBase.load(),
    async save(value) {
      await debugBase.save(value);
      notifyDebugConfigChanged();
    },
    async test(value) {
      await debugBase.save(value);
      notifyDebugConfigChanged();
      await sendSentryTestEvent();
    },
  };
  return { hub, debug };
}

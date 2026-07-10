import {
  createDebugSettingsStore,
  createHubSettingsStore,
  HUB_SETTINGS_SCOPE,
  type ScopedSettingsBackend,
  type SettingsStore,
} from "@freeanima/frontend/shell-sdk/settings";
import {
  normalizeShellClientConfig,
  type ShellClientConfig,
  type ShellDebugConfig,
} from "@freeanima/frontend/shell-sdk";

export type HubDebugSettingsStores = {
  hub: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
};

export function createHubDebugSettingsStores(options: {
  backend: ScopedSettingsBackend;
  testHub: (value: ShellClientConfig) => Promise<void>;
  onHubSave: (normalized: ShellClientConfig) => void | Promise<void>;
  notifyDebugChanged: () => void;
  notifyShellConfigChanged: () => void;
}): HubDebugSettingsStores {
  const hubBase = createHubSettingsStore(options.backend, { test: options.testHub });
  const hub: SettingsStore<ShellClientConfig> = {
    scope: hubBase.scope,
    load: () => hubBase.load(),
    test: (value) => {
      if (hubBase.test === undefined) {
        throw new Error("hub settings test handler is not configured");
      }
      return hubBase.test(value);
    },
    async save(value) {
      const normalized = normalizeShellClientConfig(value);
      await options.backend.save(HUB_SETTINGS_SCOPE, normalized);
      await options.onHubSave(normalized);
      options.notifyShellConfigChanged();
    },
  };
  const debugBase = createDebugSettingsStore(options.backend);
  const debug: SettingsStore<ShellDebugConfig> = {
    scope: debugBase.scope,
    load: () => debugBase.load(),
    async save(value) {
      await debugBase.save(value);
      options.notifyDebugChanged();
    },
  };
  return { hub, debug };
}

import {
  createDebugSettingsStore,
  createHabitatSettingsStore,
  HABITAT_SETTINGS_SCOPE,
  type ScopedSettingsBackend,
  type SettingsStore,
} from "@freeanima/client/portal-sdk/settings";
import {
  normalizeShellClientConfig,
  type ShellClientConfig,
  type ShellDebugConfig,
} from "@freeanima/client/portal-sdk";

export type HabitatDebugSettingsStores = {
  habitat: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
};

export function createHabitatDebugSettingsStores(options: {
  backend: ScopedSettingsBackend;
  testHabitat: (value: ShellClientConfig) => Promise<void>;
  onHabitatSave: (normalized: ShellClientConfig) => void | Promise<void>;
  notifyDebugChanged: () => void;
  notifyShellConfigChanged: () => void;
}): HabitatDebugSettingsStores {
  const habitatBase = createHabitatSettingsStore(options.backend, { test: options.testHabitat });
  const habitat: SettingsStore<ShellClientConfig> = {
    scope: habitatBase.scope,
    load: () => habitatBase.load(),
    test: (value) => {
      if (habitatBase.test === undefined) {
        throw new Error("habitat settings test handler is not configured");
      }
      return habitatBase.test(value);
    },
    async save(value) {
      const normalized = normalizeShellClientConfig(value);
      await options.backend.save(HABITAT_SETTINGS_SCOPE, normalized);
      await options.onHabitatSave(normalized);
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
  return { habitat, debug };
}

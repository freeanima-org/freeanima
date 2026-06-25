import {
  COMPANION_CONFIG_SCOPE,
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

import { createDesktopScopedBackend, testScopedSettings } from "./settings-ipc-backend.ts";

export type DesktopSettingsStores = {
  hub: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
  companion: SettingsStore<unknown>;
};

export function createDesktopSettingsStores(): DesktopSettingsStores {
  const backend = createDesktopScopedBackend();
  const debugBase = createScopedSettingsStore<ShellDebugConfig>({
    scope: DEBUG_SETTINGS_SCOPE,
    backend,
    parseLoad(raw) {
      return parseShellDebugConfig(raw ?? DEFAULT_SHELL_DEBUG);
    },
    normalizeSave: normalizeShellDebugConfig,
  });
  return {
    hub: createScopedSettingsStore<ShellClientConfig>({
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
        await testScopedSettings(HUB_SETTINGS_SCOPE, value);
      },
    }),
    debug: {
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
    },
    companion: createScopedSettingsStore<unknown>({
      scope: COMPANION_CONFIG_SCOPE,
      backend,
      parseLoad(raw) {
        return raw ?? {};
      },
    }),
  };
}

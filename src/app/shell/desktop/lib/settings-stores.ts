import {
  COMPANION_CONFIG_SCOPE,
  createDebugSettingsStore,
  createScopedSettingsStore,
  HUB_SETTINGS_SCOPE,
  parseHubClientSettings,
  type SettingsStore,
} from "@freeanima/frontend/shell-sdk/settings";
import {
  normalizeShellClientConfig,
  type ShellClientConfig,
  type ShellDebugConfig,
} from "@freeanima/frontend/shell-sdk";
import { sendSentryTestEvent } from "@freeanima/frontend/shell-ui/lib/sentry-test.ts";

import { createDesktopScopedBackend, testScopedSettings } from "./settings-ipc-backend.ts";

export type DesktopGeneralSettings = ShellClientConfig & {
  launchAtLogin: boolean;
};

export type DesktopSettingsStores = {
  hub: SettingsStore<DesktopGeneralSettings>;
  debug: SettingsStore<ShellDebugConfig>;
  companion: SettingsStore<unknown>;
};

function parseDesktopGeneralSettings(raw: unknown): DesktopGeneralSettings {
  const launchAtLogin =
    raw != null &&
    typeof raw === "object" &&
    typeof (raw as Record<string, unknown>).launchAtLogin === "boolean"
      ? ((raw as Record<string, unknown>).launchAtLogin as boolean)
      : false;
  return { ...parseHubClientSettings(raw), launchAtLogin };
}

function normalizeDesktopGeneralSettings(input: DesktopGeneralSettings): DesktopGeneralSettings {
  const hub = normalizeShellClientConfig(input);
  return { ...hub, launchAtLogin: Boolean(input.launchAtLogin) };
}

export function createDesktopSettingsStores(): DesktopSettingsStores {
  const backend = createDesktopScopedBackend();
  const debugBase = createDebugSettingsStore(backend);
  return {
    hub: createScopedSettingsStore<DesktopGeneralSettings>({
      scope: HUB_SETTINGS_SCOPE,
      backend,
      parseLoad: parseDesktopGeneralSettings,
      normalizeSave: normalizeDesktopGeneralSettings,
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
        await debugBase.save(value);
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

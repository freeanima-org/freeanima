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
  if (raw == null) return { hubUrl: "", remoteAuthToken: "", launchAtLogin };
  const parsed = parseShellClientConfig(raw);
  if (!parsed) return { hubUrl: "", remoteAuthToken: "", launchAtLogin };
  return { ...parsed, launchAtLogin };
}

function normalizeDesktopGeneralSettings(input: DesktopGeneralSettings): DesktopGeneralSettings {
  const hub = normalizeShellClientConfig(input);
  return { ...hub, launchAtLogin: Boolean(input.launchAtLogin) };
}

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
    hub: createScopedSettingsStore<DesktopGeneralSettings>({
      scope: HUB_SETTINGS_SCOPE,
      backend,
      parseLoad(raw) {
        return parseDesktopGeneralSettings(raw);
      },
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

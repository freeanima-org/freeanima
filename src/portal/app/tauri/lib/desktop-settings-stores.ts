import {
  COMPANION_SHELL_SCOPE,
  createScopedSettingsStore,
  HABITAT_SETTINGS_SCOPE,
  parseHabitatClientSettings,
  type SettingsStore,
} from "@freeanima/client/portal-sdk/settings";
import { normalizeShellClientConfig, type ShellClientConfig } from "@freeanima/client/portal-sdk";

import { createDesktopScopedBackend, testScopedSettings } from "./settings-ipc-backend.ts";
import type { CompanionShellSettings } from "@freeanima/features/companion/ui/spa/settings/companion-shell-settings.ts";

export type DesktopGeneralSettings = ShellClientConfig & {
  launchAtLogin: boolean;
};

export type DesktopSettingsStores = {
  habitat: SettingsStore<DesktopGeneralSettings>;
  companionShell: SettingsStore<CompanionShellSettings>;
};

function parseDesktopGeneralSettings(raw: unknown): DesktopGeneralSettings {
  const launchAtLogin =
    raw != null &&
    typeof raw === "object" &&
    typeof (raw as Record<string, unknown>).launchAtLogin === "boolean"
      ? ((raw as Record<string, unknown>).launchAtLogin as boolean)
      : false;
  return { ...parseHabitatClientSettings(raw), launchAtLogin };
}

function normalizeDesktopGeneralSettings(input: DesktopGeneralSettings): DesktopGeneralSettings {
  const habitat = normalizeShellClientConfig(input);
  return { ...habitat, launchAtLogin: input.launchAtLogin };
}

function parseCompanionShellSettings(raw: unknown): CompanionShellSettings {
  if (
    raw != null &&
    typeof raw === "object" &&
    typeof (raw as CompanionShellSettings).visible === "boolean"
  ) {
    return { visible: (raw as CompanionShellSettings).visible };
  }
  return { visible: true };
}

export function createDesktopSettingsStores(): DesktopSettingsStores {
  const backend = createDesktopScopedBackend();
  return {
    habitat: createScopedSettingsStore<DesktopGeneralSettings>({
      scope: HABITAT_SETTINGS_SCOPE,
      backend,
      parseLoad: parseDesktopGeneralSettings,
      normalizeSave: normalizeDesktopGeneralSettings,
      async test(value) {
        await testScopedSettings(HABITAT_SETTINGS_SCOPE, value);
      },
    }),
    companionShell: createScopedSettingsStore<CompanionShellSettings>({
      scope: COMPANION_SHELL_SCOPE,
      backend,
      parseLoad: parseCompanionShellSettings,
      normalizeSave: (value) => ({ visible: value.visible }),
    }),
  };
}

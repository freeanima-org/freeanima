import {
  COMPANION_SHELL_SCOPE,
  createScopedSettingsStore,
  HUB_SETTINGS_SCOPE,
  parseHubClientSettings,
  type SettingsStore,
} from "@freeanima/frontend/shell-sdk/settings";
import { normalizeShellClientConfig, type ShellClientConfig } from "@freeanima/frontend/shell-sdk";

import { createDesktopScopedBackend, testScopedSettings } from "./settings-ipc-backend.ts";
import type { CompanionShellSettings } from "@freeanima/satellites/companion/spa/settings/companion-shell-settings.ts";

export type DesktopGeneralSettings = ShellClientConfig & {
  launchAtLogin: boolean;
};

export type DesktopSettingsStores = {
  hub: SettingsStore<DesktopGeneralSettings>;
  companionShell: SettingsStore<CompanionShellSettings>;
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
    hub: createScopedSettingsStore<DesktopGeneralSettings>({
      scope: HUB_SETTINGS_SCOPE,
      backend,
      parseLoad: parseDesktopGeneralSettings,
      normalizeSave: normalizeDesktopGeneralSettings,
      async test(value) {
        await testScopedSettings(HUB_SETTINGS_SCOPE, value);
      },
    }),
    companionShell: createScopedSettingsStore<CompanionShellSettings>({
      scope: COMPANION_SHELL_SCOPE,
      backend,
      parseLoad: parseCompanionShellSettings,
      normalizeSave: (value) => ({ visible: Boolean(value.visible) }),
    }),
  };
}

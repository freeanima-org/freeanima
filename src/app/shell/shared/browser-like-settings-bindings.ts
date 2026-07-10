import { debugSettingsSection, type SettingsBinding } from "@freeanima/frontend/shell-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/about/about-section.ts";
import { alertSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/alert/alert-settings-section.ts";
import { hubConnectionSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/hub-config/hub-connection-section.ts";
import { hubConfigSettingsBindings } from "@freeanima/frontend/shell-ui/spa/settings/hub-config/hub-config-sections.ts";
import { companionHubSettingsSection } from "@freeanima/satellites/companion/spa/settings/companion-settings-section.ts";
import { createCompanionSettingsApi } from "@freeanima/satellites/companion/spa/settings/companion-settings-api.ts";
import type { SettingsStore } from "@freeanima/frontend/shell-sdk/settings";
import type { ShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config";
import type { ShellDebugConfig } from "@freeanima/frontend/shell-sdk/shell-debug-config";

export type BrowserLikeSettingsStores = {
  hub: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
};

/** Web / Capacitor 等浏览器类壳层共用的设置 bindings（hub + debug store 由调用方注入） */
export function createBrowserLikeSettingsBindings(
  stores: BrowserLikeSettingsStores,
): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: alertSettingsSection },
    { section: hubConnectionSettingsSection, store: stores.hub },
    ...hubConfigSettingsBindings,
    {
      section: companionHubSettingsSection,
      deps: { companion: createCompanionSettingsApi() },
    },
    { section: debugSettingsSection, store: stores.debug },
    { section: aboutSettingsSection },
  ];
}

import { debugSettingsSection, type SettingsBinding } from "@freeanima/frontend/shell-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/about/about-section.ts";
import { appearanceSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/appearance/appearance-section.ts";
import { chatSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/chat/chat-section.ts";
import { alertSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/alert/alert-settings-section.ts";
import { habitatConnectionSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/habitat-config/habitat-connection-section.ts";
import { habitatConfigSettingsBindings } from "@freeanima/frontend/shell-ui/spa/settings/habitat-config/habitat-config-sections.ts";
import { companionHabitatSettingsSection } from "@freeanima/satellites/companion/spa/settings/companion-settings-section.ts";
import { createCompanionSettingsApi } from "@freeanima/satellites/companion/spa/settings/companion-settings-api.ts";
import type { SettingsStore } from "@freeanima/frontend/shell-sdk/settings";
import type { ShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config";
import type { ShellDebugConfig } from "@freeanima/frontend/shell-sdk/shell-debug-config";

export type BrowserLikeSettingsStores = {
  habitat: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
};

/** Web 等浏览器类壳层共用的设置 bindings（habitat + debug store 由调用方注入） */
export function createBrowserLikeSettingsBindings(
  stores: BrowserLikeSettingsStores,
): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: appearanceSettingsSection },
    { section: chatSettingsSection },
    { section: alertSettingsSection },
    { section: habitatConnectionSettingsSection, store: stores.habitat },
    ...habitatConfigSettingsBindings,
    {
      section: companionHabitatSettingsSection,
      deps: { companion: createCompanionSettingsApi() },
    },
    { section: debugSettingsSection, store: stores.debug },
    { section: aboutSettingsSection },
  ];
}

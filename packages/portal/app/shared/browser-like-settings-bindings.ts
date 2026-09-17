import { debugSettingsSection, type SettingsBinding } from "@freeanima/portal-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/app-frame/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/app-frame/spa/settings/about/about-section.ts";
import { appearanceSettingsSection } from "@freeanima/app-frame/spa/settings/appearance/appearance-section.ts";
import { alertSettingsSection } from "@freeanima/app-frame/spa/settings/alert/alert-settings-section.ts";
import { voiceAssistantSettingsSection } from "@freeanima/app-frame/spa/settings/voice-assistant/voice-assistant-settings-section.ts";
import { habitatConnectionSettingsSection } from "@freeanima/app-frame/spa/settings/habitat-config/habitat-connection-section.ts";
import { habitatConfigSettingsBindings } from "@freeanima/app-frame/spa/settings/habitat-config/habitat-config-sections.ts";
import { companionHabitatSettingsSection } from "@freeanima/ui-features/companion/ui/spa/settings/companion-settings-section.ts";
import { createCompanionSettingsApi } from "@freeanima/ui-features/companion/ui/spa/settings/companion-settings-api.ts";
import type { SettingsStore } from "@freeanima/portal-sdk/settings";
import type { ShellClientConfig } from "@freeanima/portal-sdk/shell-client-config";
import type { ShellDebugConfig } from "@freeanima/portal-sdk/shell-debug-config";

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
    { section: alertSettingsSection },
    { section: voiceAssistantSettingsSection },
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

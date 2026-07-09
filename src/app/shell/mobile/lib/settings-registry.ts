import { debugSettingsSection, type SettingsBinding } from "@freeanima/frontend/shell-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/about/about-section.ts";
import { hubConnectionSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/hub-config/hub-connection-section.ts";
import { hubConfigSettingsBindings } from "@freeanima/frontend/shell-ui/spa/settings/hub-config/hub-config-sections.ts";
import { companionHubSettingsSection } from "@freeanima/satellites/companion/spa/settings/companion-settings-section.ts";
import { createCompanionSettingsApi } from "@freeanima/satellites/companion/spa/settings/companion-settings-api.ts";

import type { MobileSettingsStores } from "./settings-stores.ts";

export function createMobileSettingsBindings(stores: MobileSettingsStores): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
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

import {
  debugSettingsSection,
  desktopGeneralSettingsSection,
  type SettingsBinding,
} from "@freeanima/frontend/shell-sdk/settings";
import { companionSettingsSection } from "@freeanima/satellites/companion/spa/settings/companion-settings-section.ts";
import { shellModulesSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/about/about-section.ts";
import { hubConfigSettingsBindings } from "@freeanima/frontend/shell-ui/spa/settings/hub-config/hub-config-sections.ts";

import type { DesktopSettingsApis } from "./companion-settings-api.ts";
import type { DesktopSettingsStores } from "../lib/settings-stores.ts";

export function createDesktopSettingsBindings(
  stores: DesktopSettingsStores,
  apis: DesktopSettingsApis,
): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: desktopGeneralSettingsSection, store: stores.hub },
    ...hubConfigSettingsBindings,
    { section: debugSettingsSection, store: stores.debug },
    {
      section: companionSettingsSection,
      store: stores.companion,
      deps: { companion: apis.companion },
    },
    { section: aboutSettingsSection },
  ];
}

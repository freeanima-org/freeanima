import {
  desktopGeneralSettingsSection,
  type SettingsBinding,
} from "@freeanima/frontend/shell-sdk/settings";
import { companionClientSettingsSection } from "@freeanima/satellites/companion/spa/settings/companion-client-settings-section.ts";
import { companionHubSettingsSection } from "@freeanima/satellites/companion/spa/settings/companion-settings-section.ts";
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
    { section: companionClientSettingsSection, store: stores.companionShell },
    ...hubConfigSettingsBindings,
    {
      section: companionHubSettingsSection,
      deps: { companion: apis.companion },
    },
    { section: aboutSettingsSection },
  ];
}

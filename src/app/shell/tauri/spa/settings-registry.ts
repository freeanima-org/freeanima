import {
  desktopGeneralSettingsSection,
  type SettingsBinding,
} from "@freeanima/frontend/portal-sdk/settings";
import { companionClientSettingsSection } from "@freeanima/features/companion/ui/spa/settings/companion-client-settings-section.ts";
import { companionHabitatSettingsSection } from "@freeanima/features/companion/ui/spa/settings/companion-settings-section.ts";
import { shellModulesSettingsSection } from "@freeanima/frontend/app-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/frontend/app-ui/spa/settings/about/about-section.ts";
import { appearanceSettingsSection } from "@freeanima/frontend/app-ui/spa/settings/appearance/appearance-section.ts";
import { chatSettingsSection } from "@freeanima/frontend/app-ui/spa/settings/chat/chat-section.ts";
import { alertSettingsSection } from "@freeanima/frontend/app-ui/spa/settings/alert/alert-settings-section.ts";
import { habitatConfigSettingsBindings } from "@freeanima/frontend/app-ui/spa/settings/habitat-config/habitat-config-sections.ts";

import type { DesktopSettingsApis } from "./companion-settings-api.ts";
import type { DesktopSettingsStores } from "../lib/desktop-settings-stores.ts";

export function createDesktopSettingsBindings(
  stores: DesktopSettingsStores,
  apis: DesktopSettingsApis,
): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: appearanceSettingsSection },
    { section: chatSettingsSection },
    { section: alertSettingsSection },
    { section: desktopGeneralSettingsSection, store: stores.habitat },
    { section: companionClientSettingsSection, store: stores.companionShell },
    ...habitatConfigSettingsBindings,
    {
      section: companionHabitatSettingsSection,
      deps: { companion: apis.companion },
    },
    { section: aboutSettingsSection },
  ];
}

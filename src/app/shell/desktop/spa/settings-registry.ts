import {
  debugSettingsSection,
  desktopGeneralSettingsSection,
  type SettingsBinding,
} from "@freeanima/shell-sdk/settings";
import { companionSettingsSection } from "@freeanima/satellite-companion/settings-section";
import { shellModulesSettingsSection } from "@freeanima/shell-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/shell-ui/spa/settings/about/about-section.ts";
import { hubRuntimeSettingsSection } from "@freeanima/shell-ui/spa/settings/hub-config/hub-runtime-section.ts";

import type { DesktopSettingsApis } from "./companion-settings-api.ts";
import type { DesktopSettingsStores } from "../lib/settings-stores.ts";

export function createDesktopSettingsBindings(
  stores: DesktopSettingsStores,
  apis: DesktopSettingsApis,
): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: desktopGeneralSettingsSection, store: stores.hub },
    { section: hubRuntimeSettingsSection },
    { section: debugSettingsSection, store: stores.debug },
    {
      section: companionSettingsSection,
      store: stores.companion,
      deps: { companion: apis.companion },
    },
    { section: aboutSettingsSection },
  ];
}

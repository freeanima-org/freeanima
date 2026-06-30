import {
  debugSettingsSection,
  desktopGeneralSettingsSection,
  type SettingsBinding,
} from "@freeanima/shell-sdk/settings";
import { companionSettingsSection } from "@freeanima/satellite-companion/settings-section";

import type { DesktopSettingsApis } from "./companion-settings-api.ts";
import type { DesktopSettingsStores } from "../src/settings-stores.ts";

export function createDesktopSettingsBindings(
  stores: DesktopSettingsStores,
  apis: DesktopSettingsApis,
): SettingsBinding[] {
  return [
    { section: desktopGeneralSettingsSection, store: stores.hub },
    { section: debugSettingsSection, store: stores.debug },
    {
      section: companionSettingsSection,
      store: stores.companion,
      deps: { companion: apis.companion },
    },
  ];
}

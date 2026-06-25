import {
  debugSettingsSection,
  hubSettingsSection,
  type SettingsBinding,
} from "@freeanima/satellite-sdk/settings";

import type { MobileSettingsStores } from "./settings-stores.ts";

export function createMobileSettingsBindings(stores: MobileSettingsStores): SettingsBinding[] {
  return [
    { section: hubSettingsSection, store: stores.hub },
    { section: debugSettingsSection, store: stores.debug },
  ];
}

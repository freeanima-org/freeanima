import {
  debugSettingsSection,
  hubSettingsSection,
  type SettingsBinding,
} from "@freeanima/shell-sdk/settings";

import type { WebSettingsStores } from "./settings-stores.ts";

export function createWebSettingsBindings(stores: WebSettingsStores): SettingsBinding[] {
  return [
    { section: hubSettingsSection, store: stores.hub },
    { section: debugSettingsSection, store: stores.debug },
  ];
}

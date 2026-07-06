import {
  debugSettingsSection,
  hubSettingsSection,
  type SettingsBinding,
} from "@freeanima/shell-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/shell-ui/spa/settings/modules-section.ts";

import type { WebSettingsStores } from "./settings-stores.ts";

export function createWebSettingsBindings(stores: WebSettingsStores): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: hubSettingsSection, store: stores.hub },
    { section: debugSettingsSection, store: stores.debug },
  ];
}

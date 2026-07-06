import {
  debugSettingsSection,
  hubSettingsSection,
  type SettingsBinding,
} from "@freeanima/shell-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/shell-ui/spa/settings/modules-section.ts";
import { hubRuntimeSettingsSection } from "@freeanima/shell-ui/spa/settings/hub-config/hub-runtime-section.ts";

import type { MobileSettingsStores } from "./settings-stores.ts";

export function createMobileSettingsBindings(stores: MobileSettingsStores): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: hubSettingsSection, store: stores.hub },
    { section: hubRuntimeSettingsSection },
    { section: debugSettingsSection, store: stores.debug },
  ];
}

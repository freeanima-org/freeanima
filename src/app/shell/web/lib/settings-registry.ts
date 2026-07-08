import { debugSettingsSection, type SettingsBinding } from "@freeanima/shell-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/shell-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/shell-ui/spa/settings/about/about-section.ts";
import { hubConnectionSettingsSection } from "@freeanima/shell-ui/spa/settings/hub-config/hub-connection-section.ts";
import { hubRuntimeSettingsSection } from "@freeanima/shell-ui/spa/settings/hub-config/hub-runtime-section.ts";

import type { WebSettingsStores } from "./settings-stores.ts";

export function createWebSettingsBindings(stores: WebSettingsStores): SettingsBinding[] {
  return [
    { section: shellModulesSettingsSection },
    { section: hubConnectionSettingsSection, store: stores.hub },
    { section: hubRuntimeSettingsSection },
    { section: debugSettingsSection, store: stores.debug },
    { section: aboutSettingsSection },
  ];
}

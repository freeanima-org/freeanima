import { debugSettingsSection, type SettingsBinding } from "@freeanima/frontend/shell-sdk/settings";
import { shellModulesSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/modules-section.ts";
import { aboutSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/about/about-section.ts";
import { hubConnectionSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/hub-config/hub-connection-section.ts";
import { hubRuntimeSettingsSection } from "@freeanima/frontend/shell-ui/spa/settings/hub-config/hub-runtime-section.ts";

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

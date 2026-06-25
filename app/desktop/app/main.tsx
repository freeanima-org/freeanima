import { mountShellUi } from "@freeanima/shell-ui/mount";

import "../../../packages/shell-ui/app/src/styles.css";

import { createDesktopSettingsApis } from "./companion-settings-api.ts";
import { createDesktopSettingsBindings } from "./settings-registry.ts";
import { createDesktopSettingsStores } from "../src/settings-stores.ts";

const stores = createDesktopSettingsStores();
const apis = createDesktopSettingsApis();
const bindings = createDesktopSettingsBindings(stores, apis);

void mountShellUi({ bindings });

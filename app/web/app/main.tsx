import { mountShellUi } from "@freeanima/shell-ui/mount";

import "../../../packages/shell-ui/app/src/styles.css";

import { createWebSettingsBindings } from "../src/settings-registry.ts";
import { createWebSettingsStores } from "../src/settings-stores.ts";

const stores = createWebSettingsStores();
const bindings = createWebSettingsBindings(stores);

void mountShellUi({ bindings });

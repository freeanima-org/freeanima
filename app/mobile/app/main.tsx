import { mountShellUi } from "@freeanima/shell-ui/mount";

import "../../../packages/shell-ui/app/src/styles.css";

import { createMobileSettingsBindings } from "../src/settings-registry.ts";
import { createMobileSettingsStores } from "../src/settings-stores.ts";

const stores = createMobileSettingsStores();
const bindings = createMobileSettingsBindings(stores);

void mountShellUi({ bindings });

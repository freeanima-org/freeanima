import { mountShellUi, renderShellMountFailure } from "@freeanima/shell-ui/mount";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "../../../packages/shell-ui/app/src/styles.css";

import { createMobileSettingsBindings } from "../src/settings-registry.ts";
import { createMobileSettingsStores } from "../src/settings-stores.ts";

const stores = createMobileSettingsStores();
const bindings = createMobileSettingsBindings(stores);

void mountShellUi({ bindings }).catch((err) => {
  console.error("[app-mobile]", err);
  renderShellMountFailure(err);
});

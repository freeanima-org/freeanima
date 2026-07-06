import { mountShellUi, renderShellMountFailure } from "@freeanima/shell-ui/mount";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "../../../frontend/shell-ui/spa/styles.css";

import { createMobileSettingsBindings } from "../lib/settings-registry.ts";
import { createMobileSettingsStores } from "../lib/settings-stores.ts";

const stores = createMobileSettingsStores();
const bindings = createMobileSettingsBindings(stores);

void mountShellUi({ bindings }).catch((err) => {
  console.error("[app-mobile]", err);
  renderShellMountFailure(err);
});

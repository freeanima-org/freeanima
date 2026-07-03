import { mountShellUi } from "@freeanima/shell-ui/mount";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "../../../frontend/shell-ui/app/src/styles.css";

import { PwaNotices } from "../src/pwa/PwaNotices.tsx";
import { resolveShellBindings } from "../src/shell-composition.ts";

void (async () => {
  const bindings = await resolveShellBindings();
  await mountShellUi({ bindings, headerSlot: <PwaNotices /> });
})();

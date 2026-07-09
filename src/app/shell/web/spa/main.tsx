import { mountShellUi } from "@freeanima/frontend/shell-ui/spa/mount.tsx";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "@freeanima/frontend/shell-ui/spa/styles.css";

import { PwaNotices } from "../lib/pwa/PwaNotices.tsx";
import { resolveShellBindings } from "../lib/shell-composition.ts";

void (async () => {
  const bindings = await resolveShellBindings();
  await mountShellUi({ bindings, headerSlot: <PwaNotices /> });
})();

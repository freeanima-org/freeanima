import { mountShellUi } from "@freeanima/shell-ui/mount";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "../../../../frontend/shell-ui/spa/styles.css";

import { PwaNotices } from "../lib/pwa/PwaNotices.tsx";
import { resolveShellBindings } from "../lib/shell-composition.ts";

void (async () => {
  const bindings = await resolveShellBindings();
  await mountShellUi({ bindings, headerSlot: <PwaNotices /> });
})();

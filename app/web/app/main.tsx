// oxlint-disable-next-line import/no-unassigned-import -- 须在 mount 前注入 satelliteShell / freeanimaScopedSettings
import "./shell-bridge.ts";

import { mountShellUi } from "@freeanima/shell-ui/mount";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "../../../packages/shell-ui/app/src/styles.css";

import { PwaNotices } from "../src/pwa/PwaNotices.tsx";
import { resolveShellBindings } from "../src/shell-composition.ts";

void (async () => {
  const bindings = await resolveShellBindings();
  await mountShellUi({ bindings, headerSlot: <PwaNotices /> });
})();

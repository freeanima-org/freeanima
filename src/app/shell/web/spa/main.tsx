import { mountShellUi } from "@freeanima/frontend/shell-ui/spa/mount.tsx";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "@freeanima/frontend/shell-ui/spa/styles.css";

import { PwaNotices } from "../lib/pwa/PwaNotices.tsx";
import { registerShellAlertBackend } from "../lib/register-alert-backend.ts";
import { resolveShellBindings } from "../lib/shell-composition.ts";

void (async () => {
  const bridge = (window as Window & { __freeanimaShellBridge?: { ready: Promise<void> } })
    .__freeanimaShellBridge;
  if (bridge) {
    try {
      await bridge.ready;
    } catch {
      /* 桥接失败时仍尝试注册 web/capacitor 后端 */
    }
  }
  await registerShellAlertBackend();
  const bindings = await resolveShellBindings();
  await mountShellUi({ bindings, noticeWatchers: <PwaNotices /> });
})();

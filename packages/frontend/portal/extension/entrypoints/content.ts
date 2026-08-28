import {
  attachSavePrompt,
  fillActiveField,
  fillCard,
  fillIdentity,
  fillLogin,
} from "../features/vault/dom-fill.ts";
import { dispatchVaultFillMessage } from "../features/vault/fill-dispatch.ts";
import { attachPageAutofillUi } from "../features/vault/page-ui.ts";
import {
  isSavePromptMuted,
  muteSavePromptForHost,
} from "../features/vault/save-prompt-settings.ts";
import { showSaveLoginPrompt } from "../features/vault/save-prompt-ui.ts";
import type { FillPayload } from "../runtime/messages.ts";
import { sendBg } from "../runtime/messages.ts";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  allFrames: true,
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener(
      (msg: { type: string; fill?: FillPayload; password?: string; value?: string }) => {
        dispatchVaultFillMessage(msg, {
          hasFocus: () => document.hasFocus(),
          fillLogin,
          fillActiveField,
          fillCard,
          fillIdentity,
        });
      },
    );

    attachPageAutofillUi();

    let lastPromptAt = 0;
    attachSavePrompt((creds) => {
      const now = Date.now();
      if (now - lastPromptAt < 5000) return;
      lastPromptAt = now;
      const url = location.origin + location.pathname;
      const title = document.title || location.hostname;
      void (async () => {
        const status = await sendBg({ type: "get_status" });
        if (!status.ok || !("unlocked" in status) || !status.unlocked) return;
        if (!status.online) return;
        const existing = await sendBg({
          type: "check_login",
          url,
          username: creds.username,
          password: creds.password,
        });
        const exists = existing.ok && "exists" in existing && existing.exists;
        const needsUpdate =
          exists && "needs_password_update" in existing && Boolean(existing.needs_password_update);
        if (exists && !needsUpdate) return;
        if (await isSavePromptMuted(location.hostname)) return;
        const action = await showSaveLoginPrompt({
          mode: needsUpdate ? "update" : "save",
          username: creds.username,
          url,
        });
        if (action === "cancel") return;
        if (action === "mute") {
          await muteSavePromptForHost(location.hostname);
          return;
        }
        const res = await sendBg({
          type: "save_login",
          title,
          url,
          username: creds.username,
          password: creds.password,
        });
        if (!res.ok) {
          console.warn("[FreeAnima] vault save failed", res.error);
        }
      })();
    });
  },
});

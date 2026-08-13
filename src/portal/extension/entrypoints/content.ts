import {
  attachSavePrompt,
  fillActiveField,
  fillCard,
  fillIdentity,
  fillLogin,
} from "../features/vault/dom-fill.ts";
import { attachPageAutofillUi } from "../features/vault/page-ui.ts";
import type { FillPayload } from "../runtime/messages.ts";
import { sendBg } from "../runtime/messages.ts";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener(
      (msg: { type: string; fill?: FillPayload; password?: string; value?: string }) => {
        if (msg.type === "fill_login" && msg.fill) fillLogin(msg.fill);
        if (msg.type === "fill_password_only" && msg.password) fillActiveField(msg.password);
        if (msg.type === "fill_field" && typeof msg.value === "string") fillActiveField(msg.value);
        if (msg.type === "fill_card" && msg.fill) fillCard(msg.fill);
        if (msg.type === "fill_identity" && msg.fill) fillIdentity(msg.fill);
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
        });
        if (existing.ok && "exists" in existing && existing.exists) return;
        const ok = window.confirm(
          `将登录凭据保存到 FreeAnima 保险库？\n${creds.username || "(无用户名)"}\n${url}`,
        );
        if (!ok) return;
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

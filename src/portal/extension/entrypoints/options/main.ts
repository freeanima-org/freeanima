import { sendBg } from "../../runtime/messages.ts";
import { loadSettings, saveSettings } from "../../runtime/settings.ts";

const urlEl = document.getElementById("url") as HTMLInputElement;
const tokenEl = document.getElementById("token") as HTMLInputElement;
const msgEl = document.getElementById("msg");

void loadSettings().then((s) => {
  urlEl.value = s.habitat_url;
  tokenEl.value = s.auth_token;
});

document.getElementById("save")?.addEventListener("click", () => {
  void (async () => {
    await saveSettings({ habitat_url: urlEl.value, auth_token: tokenEl.value });
    if (msgEl) {
      msgEl.className = "msg ok";
      msgEl.textContent = "已保存";
    }
  })();
});

document.getElementById("test")?.addEventListener("click", () => {
  void (async () => {
    await saveSettings({ habitat_url: urlEl.value, auth_token: tokenEl.value });
    const res = await sendBg({ type: "test_connection" });
    if (!msgEl) return;
    if (res.ok && "message" in res) {
      msgEl.className = "msg ok";
      msgEl.textContent = res.message;
    } else if (!res.ok) {
      msgEl.className = "msg err";
      msgEl.textContent = res.error;
    }
  })();
});

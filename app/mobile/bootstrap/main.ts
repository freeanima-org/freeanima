import { waitForCapacitorBridge } from "../src/capacitor-ready.ts";
import {
  loadHubUrl,
  loadRemoteAuthToken,
  saveShellClientPrefs,
  testHubConnection,
} from "../src/mobile-shell.ts";

function setStatus(message: string): void {
  const el = document.getElementById("boot-status");
  if (el) el.textContent = message;
}

function mountSetupForm(): void {
  document.body.innerHTML = `
    <div style="max-width:420px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;color:#e5e7eb;background:#1d232a;min-height:100vh;">
      <h1 style="font-size:18px;margin:0 0 16px;">Hub 设置</h1>
      <p style="font-size:13px;color:#9ca3af;margin:0 0 16px;">配置 Hub 后将打开远程 Web UI。</p>
      <label style="display:block;font-size:13px;margin-bottom:6px;">Hub URL</label>
      <input id="hub-url" type="url" placeholder="https://example.com 或 http://192.168.x.x:2658"
        style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:12px;border-radius:8px;border:1px solid #374151;background:#111827;color:#f3f4f6;" />
      <label style="display:block;font-size:13px;margin-bottom:6px;">Service API Token</label>
      <input id="hub-token" type="password" placeholder="fa_at_..."
        style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:16px;border-radius:8px;border:1px solid #374151;background:#111827;color:#f3f4f6;" />
      <button id="hub-save" type="button"
        style="width:100%;padding:10px;border:none;border-radius:8px;background:#570df8;color:white;font-weight:600;">保存并进入</button>
      <p id="hub-error" style="color:#f87171;font-size:12px;margin-top:12px;min-height:1.2em;"></p>
    </div>`;

  const urlInput = document.getElementById("hub-url") as HTMLInputElement;
  const tokenInput = document.getElementById("hub-token") as HTMLInputElement;
  const errorEl = document.getElementById("hub-error") as HTMLParagraphElement;
  const saveBtn = document.getElementById("hub-save") as HTMLButtonElement;

  saveBtn.addEventListener("click", () => {
    void (async () => {
      errorEl.textContent = "";
      saveBtn.disabled = true;
      try {
        const hubUrl = urlInput.value.trim();
        const token = tokenInput.value.trim();
        await testHubConnection(hubUrl, token);
        await saveShellClientPrefs(hubUrl, token);
        window.location.replace(`${hubUrl.replace(/\/$/, "")}/web/chat`);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : String(err);
        saveBtn.disabled = false;
      }
    })();
  });
}

async function bootstrapRemoteUi(): Promise<void> {
  await waitForCapacitorBridge();
  const hubUrl = await loadHubUrl();
  if (!hubUrl) {
    setStatus("请先配置 Hub");
    mountSetupForm();
    return;
  }
  const token = (await loadRemoteAuthToken()) ?? "";
  try {
    await testHubConnection(hubUrl, token);
  } catch (err) {
    setStatus("Hub 连接失败，请检查设置");
    mountSetupForm();
    if (hubUrl)
      (document.getElementById("hub-url") as HTMLInputElement | null)?.setAttribute(
        "value",
        hubUrl,
      );
    console.error("[mobile-bootstrap]", err);
    return;
  }
  window.location.replace(`${hubUrl.replace(/\/$/, "")}/web/chat`);
}

void bootstrapRemoteUi().catch((err) => {
  console.error("[mobile-bootstrap]", err);
  setStatus("启动失败");
  mountSetupForm();
});

import { probeHubHealthUrl } from "@freeanima/shell-sdk";
import { waitForCapacitorBridge } from "../lib/capacitor-ready.ts";
import { persistNativeBuildMetaFromDefine } from "../lib/native-build-meta-prefs.ts";
import {
  loadHubUrl,
  loadRemoteAuthToken,
  normalizeHubUrl,
  saveShellClientPrefs,
  testHubConnection,
} from "../lib/mobile-shell.ts";

const PAGE_BG = "#1d232a";

function applyBootstrapShellStyles(): void {
  document.documentElement.style.height = "100%";
  document.documentElement.style.background = PAGE_BG;
  document.body.style.margin = "0";
  document.body.style.height = "100%";
  document.body.style.background = PAGE_BG;
  document.body.style.overflow = "hidden";
  document.body.style.overscrollBehavior = "none";
}

function setStatus(message: string): void {
  const el = document.getElementById("boot-status");
  if (el) el.textContent = message;
}

function readHubFormValues(): { hubUrl: string; token: string } {
  const urlInput = document.getElementById("hub-url") as HTMLInputElement;
  const tokenInput = document.getElementById("hub-token") as HTMLInputElement;
  return { hubUrl: urlInput.value.trim(), token: tokenInput.value.trim() };
}

async function probeHubFormConnection(hubUrl: string, token: string): Promise<string> {
  const normalized = normalizeHubUrl(hubUrl);
  const body = await probeHubHealthUrl(normalized, token ? { token } : {});
  if (body.status !== "ok") return "Hub 可达，但服务状态异常";
  if (body.authed === false) return "Hub 可达，但认证失败：请检查 Service API Token";
  return "连接成功";
}

function mountSetupForm(prefill?: { hubUrl?: string | null }): void {
  applyBootstrapShellStyles();
  document.body.innerHTML = `
    <div style="box-sizing:border-box;max-width:420px;height:100%;margin:0 auto;padding:24px;padding-top:max(24px, env(safe-area-inset-top));padding-bottom:max(24px, env(safe-area-inset-bottom));padding-left:max(24px, env(safe-area-inset-left));padding-right:max(24px, env(safe-area-inset-right));font-family:system-ui,sans-serif;color:#e5e7eb;background:${PAGE_BG};overflow:auto;overscroll-behavior:contain;">
      <h1 style="font-size:18px;margin:0 0 16px;">Hub 设置</h1>
      <p style="font-size:13px;color:#9ca3af;margin:0 0 16px;">配置 Hub 后将打开远程 Web UI。</p>
      <label style="display:block;font-size:13px;margin-bottom:6px;">Hub URL</label>
      <input id="hub-url" type="url" placeholder="https://example.com 或 http://192.168.x.x:2658"
        style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:12px;border-radius:8px;border:1px solid #374151;background:#111827;color:#f3f4f6;" />
      <label style="display:block;font-size:13px;margin-bottom:6px;">Service API Token</label>
      <input id="hub-token" type="password" placeholder="fa_at_..."
        style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:16px;border-radius:8px;border:1px solid #374151;background:#111827;color:#f3f4f6;" />
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button id="hub-test" type="button"
          style="flex:1;padding:10px;border:1px solid #4b5563;border-radius:8px;background:#111827;color:#e5e7eb;font-weight:600;">测试连接</button>
        <button id="hub-save" type="button"
          style="flex:1;padding:10px;border:none;border-radius:8px;background:#570df8;color:white;font-weight:600;">保存并进入</button>
      </div>
      <p id="hub-status" style="color:#4ade80;font-size:12px;margin:0;min-height:1.2em;"></p>
      <p id="hub-error" style="color:#f87171;font-size:12px;margin-top:8px;min-height:1.2em;"></p>
    </div>`;

  const urlInput = document.getElementById("hub-url") as HTMLInputElement;
  const errorEl = document.getElementById("hub-error") as HTMLParagraphElement;
  const statusEl = document.getElementById("hub-status") as HTMLParagraphElement;
  const testBtn = document.getElementById("hub-test") as HTMLButtonElement;
  const saveBtn = document.getElementById("hub-save") as HTMLButtonElement;

  if (prefill?.hubUrl) urlInput.value = prefill.hubUrl;

  const setBusy = (busy: boolean): void => {
    testBtn.disabled = busy;
    saveBtn.disabled = busy;
  };

  testBtn.addEventListener("click", () => {
    void (async () => {
      errorEl.textContent = "";
      statusEl.textContent = "";
      setBusy(true);
      try {
        const { hubUrl, token } = readHubFormValues();
        if (!hubUrl) throw new Error("请先填写 Hub URL");
        statusEl.textContent = await probeHubFormConnection(hubUrl, token);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : String(err);
      } finally {
        setBusy(false);
      }
    })();
  });

  saveBtn.addEventListener("click", () => {
    void (async () => {
      errorEl.textContent = "";
      statusEl.textContent = "";
      setBusy(true);
      try {
        const { hubUrl, token } = readHubFormValues();
        await testHubConnection(hubUrl, token);
        await saveShellClientPrefs(hubUrl, token);
        window.location.replace(`${normalizeHubUrl(hubUrl)}/web/chat`);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : String(err);
        setBusy(false);
      }
    })();
  });
}

async function bootstrapRemoteUi(): Promise<void> {
  await waitForCapacitorBridge();
  await persistNativeBuildMetaFromDefine();
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
    mountSetupForm({ hubUrl });
    console.error("[mobile-bootstrap]", err);
    return;
  }
  window.location.replace(`${normalizeHubUrl(hubUrl)}/web/chat`);
}

void bootstrapRemoteUi().catch((err) => {
  console.error("[mobile-bootstrap]", err);
  setStatus("启动失败");
  mountSetupForm();
});

import {
  buildMobileShell,
  loadHubUrl,
  loadRemoteAuthToken,
  normalizeHubUrl,
  saveShellClientPrefs,
  testHubConnection,
} from "../mobile-shell.ts";
import { HOME_PAGE } from "../paths.ts";

const hubInput = document.getElementById("hub-url") as HTMLInputElement;
const tokenInput = document.getElementById("remote-auth-token") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const btnTest = document.getElementById("btn-test") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;

function setStatus(message: string, kind: "ok" | "err" | "hidden"): void {
  if (kind === "hidden") {
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

function currentValues(): { hubUrl: string; remoteAuthToken: string } {
  return {
    hubUrl: normalizeHubUrl(hubInput.value),
    remoteAuthToken: tokenInput.value.trim(),
  };
}

async function init(): Promise<void> {
  const [savedHub, savedToken] = await Promise.all([loadHubUrl(), loadRemoteAuthToken()]);
  if (savedHub) hubInput.value = savedHub;
  if (savedToken) tokenInput.value = savedToken;
}

btnTest.addEventListener("click", () => {
  void (async () => {
    btnTest.disabled = true;
    setStatus("正在测试连接…", "ok");
    try {
      const { hubUrl, remoteAuthToken } = currentValues();
      await testHubConnection(hubUrl, remoteAuthToken);
      setStatus("连接成功", "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "连接失败", "err");
    } finally {
      btnTest.disabled = false;
    }
  })();
});

btnSave.addEventListener("click", () => {
  void (async () => {
    btnSave.disabled = true;
    setStatus("正在保存…", "ok");
    try {
      const { hubUrl, remoteAuthToken } = currentValues();
      await saveShellClientPrefs(hubUrl, remoteAuthToken);
      await buildMobileShell(hubUrl, remoteAuthToken);
      window.location.replace(HOME_PAGE);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "保存失败", "err");
      btnSave.disabled = false;
    }
  })();
});

void init();

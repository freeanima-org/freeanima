import { resolveHubWsUrl } from "@freeanima/sap-contract/urls";

import {
  buildMobileShell,
  loadHubUrl,
  normalizeHubUrl,
  saveHubUrl,
  testHubConnection,
} from "../mobile-shell.ts";
import { CHAT_PAGE } from "../paths.ts";

const hubInput = document.getElementById("hub-url") as HTMLInputElement;
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

function currentHubUrl(): string {
  return normalizeHubUrl(hubInput.value);
}

async function init(): Promise<void> {
  const saved = await loadHubUrl();
  if (saved) hubInput.value = saved;
}

btnTest.addEventListener("click", () => {
  void (async () => {
    btnTest.disabled = true;
    setStatus("正在测试连接…", "ok");
    try {
      const hubUrl = currentHubUrl();
      const wsUrl = resolveHubWsUrl(hubUrl);
      await testHubConnection(wsUrl);
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
      const hubUrl = currentHubUrl();
      await saveHubUrl(hubUrl);
      await buildMobileShell(hubUrl);
      window.location.replace(CHAT_PAGE);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "保存失败", "err");
      btnSave.disabled = false;
    }
  })();
});

void init();

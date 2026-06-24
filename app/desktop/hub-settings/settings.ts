type HubSettingsApi = {
  load(): Promise<{ hubUrl: string; remoteAuthToken: string } | null>;
  save(cfg: { hubUrl: string; remoteAuthToken: string }): Promise<unknown>;
  test(cfg: { hubUrl: string; remoteAuthToken: string }): Promise<boolean>;
};

declare global {
  interface Window {
    hubSettingsApi?: HubSettingsApi;
  }
}

const hubInput = document.getElementById("hub-url") as HTMLInputElement;
const tokenInput = document.getElementById("remote-auth-token") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const btnTest = document.getElementById("btn-test") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;

function api(): HubSettingsApi {
  if (!window.hubSettingsApi) throw new Error("hubSettingsApi 不可用");
  return window.hubSettingsApi;
}

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
    hubUrl: hubInput.value.trim(),
    remoteAuthToken: tokenInput.value.trim(),
  };
}

async function init(): Promise<void> {
  const saved = await api().load();
  if (saved?.hubUrl) hubInput.value = saved.hubUrl;
  if (saved?.remoteAuthToken) tokenInput.value = saved.remoteAuthToken;
}

btnTest.addEventListener("click", () => {
  void (async () => {
    btnTest.disabled = true;
    setStatus("正在测试连接…", "ok");
    try {
      await api().test(currentValues());
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
      await api().save(currentValues());
      setStatus("已保存。请重启 FreeAnima Desktop。", "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "保存失败", "err");
    } finally {
      btnSave.disabled = false;
    }
  })();
});

void init().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});

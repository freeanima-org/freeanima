// hub-settings/settings.ts
var hubInput = document.getElementById("hub-url");
var tokenInput = document.getElementById("remote-auth-token");
var statusEl = document.getElementById("status");
var btnTest = document.getElementById("btn-test");
var btnSave = document.getElementById("btn-save");
function api() {
  if (!window.hubSettingsApi) throw new Error("hubSettingsApi \u4E0D\u53EF\u7528");
  return window.hubSettingsApi;
}
function setStatus(message, kind) {
  if (kind === "hidden") {
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}
function currentValues() {
  return {
    hubUrl: hubInput.value.trim(),
    remoteAuthToken: tokenInput.value.trim(),
  };
}
async function init() {
  const saved = await api().load();
  if (saved?.hubUrl) hubInput.value = saved.hubUrl;
  if (saved?.remoteAuthToken) tokenInput.value = saved.remoteAuthToken;
}
btnTest.addEventListener("click", () => {
  void (async () => {
    btnTest.disabled = true;
    setStatus("\u6B63\u5728\u6D4B\u8BD5\u8FDE\u63A5\u2026", "ok");
    try {
      await api().test(currentValues());
      setStatus("\u8FDE\u63A5\u6210\u529F", "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "\u8FDE\u63A5\u5931\u8D25", "err");
    } finally {
      btnTest.disabled = false;
    }
  })();
});
btnSave.addEventListener("click", () => {
  void (async () => {
    btnSave.disabled = true;
    setStatus("\u6B63\u5728\u4FDD\u5B58\u2026", "ok");
    try {
      await api().save(currentValues());
      setStatus("\u5DF2\u4FDD\u5B58\u3002\u8BF7\u91CD\u542F FreeAnima Desktop\u3002", "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "\u4FDD\u5B58\u5931\u8D25", "err");
    } finally {
      btnSave.disabled = false;
    }
  })();
});
void init().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});

import {
  buildMobileShell,
  loadHubUrl,
  loadRemoteAuthToken,
  saveShellClientPrefs,
  testHubConnection,
} from "./mobile-shell.ts";
import { CHAT_PAGE, SETTINGS_PAGE } from "./paths.ts";

function installSettingsShellClientApi(): void {
  window.settingsShellClientApi = {
    async load() {
      const [hubUrl, remoteAuthToken] = await Promise.all([loadHubUrl(), loadRemoteAuthToken()]);
      if (!hubUrl || !remoteAuthToken) return null;
      return { hubUrl, remoteAuthToken };
    },
    async save(cfg) {
      await saveShellClientPrefs(cfg.hubUrl, cfg.remoteAuthToken);
      await buildMobileShell(cfg.hubUrl, cfg.remoteAuthToken);
    },
    async test(cfg) {
      await testHubConnection(cfg.hubUrl, cfg.remoteAuthToken);
    },
  };
}

async function bootstrapShellBridge(): Promise<void> {
  installSettingsShellClientApi();
  document.documentElement.dataset.shellUi = "1";

  const path = window.location.pathname;
  if (path.startsWith("/settings")) return;

  const hubUrl = await loadHubUrl();
  const remoteAuthToken = await loadRemoteAuthToken();
  if (!hubUrl || !remoteAuthToken) {
    if (path !== SETTINGS_PAGE) window.location.replace(SETTINGS_PAGE);
    return;
  }

  const shell = await buildMobileShell(hubUrl, remoteAuthToken);
  window.satelliteShell = shell;

  if (path === "/" || path.endsWith("/index.html")) {
    window.location.replace(CHAT_PAGE);
  }
}

void bootstrapShellBridge().catch((err) => {
  console.error("[shell-bridge]", err);
});

declare global {
  interface Window {
    settingsShellClientApi?: {
      load(): Promise<{ hubUrl: string; remoteAuthToken: string } | null>;
      save(cfg: { hubUrl: string; remoteAuthToken: string }): Promise<void>;
      test(cfg: { hubUrl: string; remoteAuthToken: string }): Promise<void>;
    };
  }
}

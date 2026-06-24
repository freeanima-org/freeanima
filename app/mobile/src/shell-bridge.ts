import {
  buildMobileShell,
  createMobileShellStub,
  loadHubUrl,
  loadRemoteAuthToken,
  saveShellClientPrefs,
  SHELL_CONFIG_CHANGED_EVENT,
  testHubConnection,
} from "./mobile-shell.ts";
import { CHAT_PAGE, SETTINGS_PAGE } from "./paths.ts";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
};

function installShellBridgeReady(): () => void {
  let resolveReady!: () => void;
  (window as ShellBridgeWindow).__freeanimaShellBridge = {
    ready: new Promise<void>((resolve) => {
      resolveReady = resolve;
    }),
  };
  return resolveReady;
}

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

function installSettingsShellClientApi(): void {
  window.settingsShellClientApi = {
    async load() {
      const [hubUrl, remoteAuthToken] = await Promise.all([loadHubUrl(), loadRemoteAuthToken()]);
      if (!hubUrl || !remoteAuthToken) return null;
      return { hubUrl, remoteAuthToken };
    },
    async save(cfg) {
      await saveShellClientPrefs(cfg.hubUrl, cfg.remoteAuthToken);
      window.satelliteShell = await buildMobileShell(cfg.hubUrl, cfg.remoteAuthToken);
      notifyShellConfigChanged();
    },
    async test(cfg) {
      await testHubConnection(cfg.hubUrl, cfg.remoteAuthToken);
    },
  };
}

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  installSettingsShellClientApi();
  document.documentElement.dataset.shellUi = "1";
  window.satelliteShell = createMobileShellStub();

  try {
    const path = window.location.pathname;
    const hubUrl = await loadHubUrl();
    const remoteAuthToken = await loadRemoteAuthToken();

    if (hubUrl && remoteAuthToken) {
      window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken);
    }

    if (path.startsWith("/settings")) return;

    if (!hubUrl || !remoteAuthToken) {
      if (path !== SETTINGS_PAGE) window.location.replace(SETTINGS_PAGE);
      return;
    }

    if (path === "/" || path.endsWith("/index.html")) {
      window.location.replace(CHAT_PAGE);
    }
  } finally {
    finish();
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

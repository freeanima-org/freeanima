import {
  buildMobileShell,
  createMobileShellStub,
  loadHubUrl,
  loadRemoteAuthToken,
  saveShellClientPrefs,
  SHELL_CONFIG_CHANGED_EVENT,
  testHubConnection,
} from "./mobile-shell.ts";
import {
  DEBUG_CONFIG_CHANGED_EVENT,
  loadShellDebugPrefs,
  saveShellDebugPrefs,
} from "./mobile-debug-prefs.ts";
import { applyMobileDebugConsole } from "./debug-console.ts";
import { CHAT_PAGE, SETTINGS_PAGE } from "./paths.ts";
import { readShellPath, replaceShellPath } from "./shell-nav.ts";
import type { ShellDebugConfig } from "@freeanima/satellite-sdk";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
};

/** Capacitor 原生桥就绪后再调用 Preferences 等插件 */
async function waitForNativeBridge(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", () => resolve(), { once: true });
  });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

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

function installDebugSettingsApi(): void {
  window.debugSettingsApi = {
    async load() {
      return loadShellDebugPrefs();
    },
    async save(cfg: ShellDebugConfig) {
      const saved = await saveShellDebugPrefs(cfg);
      await applyMobileDebugConsole(saved.vConsoleEnabled);
    },
  };
}

async function bootstrapDebugConsole(): Promise<void> {
  const debug = await loadShellDebugPrefs();
  if (debug.vConsoleEnabled) {
    await applyMobileDebugConsole(true);
  }
}

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  installSettingsShellClientApi();
  installDebugSettingsApi();
  document.documentElement.dataset.shellUi = "1";
  window.satelliteShell = createMobileShellStub();

  try {
    await waitForNativeBridge();
    await bootstrapDebugConsole();

    const path = readShellPath();
    const hubUrl = await loadHubUrl();
    const remoteAuthToken = await loadRemoteAuthToken();

    if (hubUrl && remoteAuthToken) {
      window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken);
    }

    if (path.startsWith("/settings")) return;

    if (!hubUrl || !remoteAuthToken) {
      if (path !== SETTINGS_PAGE) replaceShellPath(SETTINGS_PAGE);
      return;
    }

    if (path === "/" || path.endsWith("/index.html")) {
      replaceShellPath(CHAT_PAGE);
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
    debugSettingsApi?: {
      load(): Promise<ShellDebugConfig>;
      save(cfg: ShellDebugConfig): Promise<void>;
    };
  }
  const __MOBILE_DEBUG__: boolean | undefined;
}

export { DEBUG_CONFIG_CHANGED_EVENT };

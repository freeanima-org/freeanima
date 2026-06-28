import {
  buildMobileShell,
  createMobileShellStub,
  loadHubUrl,
  loadRemoteAuthToken,
} from "./mobile-shell.ts";
import { waitForCapacitorBridge } from "./capacitor-ready.ts";
import { loadShellDebugPrefs } from "./mobile-debug-prefs.ts";
import { applyMobileDebugConsole } from "./debug-console.ts";
import { CHAT_PAGE, SETTINGS_PAGE } from "./paths.ts";
import { readShellPath, replaceShellPath } from "./shell-nav.ts";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
  __freeanimaShellBootError?: string;
};

export const SHELL_BOOT_ERROR_KEY = "__freeanimaShellBootError";

/** Capacitor 原生桥就绪后再调用 Preferences 等插件 */
async function waitForNativeBridge(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", () => resolve(), { once: true });
  });
  await waitForCapacitorBridge();
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

function setShellBootError(message: string): void {
  (window as ShellBridgeWindow)[SHELL_BOOT_ERROR_KEY] = message;
}

async function bootstrapDebugConsole(): Promise<void> {
  const debug = await loadShellDebugPrefs();
  if (debug.vConsoleEnabled) {
    await applyMobileDebugConsole(true);
  }
}

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.shellUi = "1";
  window.satelliteShell = createMobileShellStub();

  try {
    await waitForNativeBridge();
    await bootstrapDebugConsole();

    const path = readShellPath();
    const hubUrl = await loadHubUrl();
    const remoteAuthToken = await loadRemoteAuthToken();

    if (hubUrl) {
      window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken ?? "");
    }

    if (path.startsWith("/settings")) return;

    if (!hubUrl) {
      if (path !== SETTINGS_PAGE) replaceShellPath(SETTINGS_PAGE);
      return;
    }

    if (path === "/" || path.endsWith("/index.html")) {
      replaceShellPath(CHAT_PAGE);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[shell-bridge]", err);
    setShellBootError(message);
    window.satelliteShell = createMobileShellStub();
    const path = readShellPath();
    if (!path.startsWith("/settings") && path !== SETTINGS_PAGE) {
      replaceShellPath(SETTINGS_PAGE);
    }
  } finally {
    finish();
  }
}

void bootstrapShellBridge();

declare global {
  const __MOBILE_DEBUG__: boolean | undefined;
}

export const DEBUG_CONFIG_CHANGED_EVENT = "freeanima:debug-config-changed";

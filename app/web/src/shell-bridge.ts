import { parseShellClientConfig } from "@freeanima/shell-sdk/shell-client-config";
import type { SettingsStorageScope } from "@freeanima/shell-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/shell-sdk/settings";
import { HUB_SETTINGS_SCOPE } from "@freeanima/shell-sdk/settings";
import { parseWebUiConfigJson, type WebUiConfigJson } from "@freeanima/shell-sdk/web-ui-config";

import { waitForCapacitorBridge } from "@freeanima/app-mobile/capacitor-ready";
import {
  buildMobileShell,
  createMobileShellStub,
  loadHubUrl,
  loadRemoteAuthToken,
} from "@freeanima/app-mobile/mobile-shell";
import { createWebScopedBackend, seedWebHubPrefsIfEmpty } from "./settings-local-backend.ts";
import {
  buildWebShellFromRaw,
  createWebShellStub,
  installWebShellFromPrefs,
  testWebHubConnection,
  webNeedsHubSetupFromConfig,
} from "./web-shell.ts";

type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
  __freeanimaWebUiConfig?: Pick<
    WebUiConfigJson,
    "layout_mode" | "ui_version" | "min_shell_version"
  >;
};

type ScopedSettingsBridge = ScopedSettingsBackend & {
  test(scope: SettingsStorageScope, value: unknown): Promise<unknown>;
};

declare global {
  interface Window {
    freeanimaScopedSettings?: ScopedSettingsBridge;
    __freeanimaWebUiConfig?: Pick<
      WebUiConfigJson,
      "layout_mode" | "ui_version" | "min_shell_version"
    >;
  }
}

declare global {
  const __WEB_DEFAULT_HUB_URL__: string;
  const __WEB_DEFAULT_REMOTE_AUTH_TOKEN__: string;
}

function isCapacitorRuntime(): boolean {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() ?? cap);
}

function installShellBridgeReady(): () => void {
  const w = window as ShellBridgeWindow;
  if (w.__freeanimaShellBridge?.ready) {
    return () => {};
  }
  let resolveReady!: () => void;
  w.__freeanimaShellBridge = {
    ready: new Promise<void>((resolve) => {
      resolveReady = resolve;
    }),
  };
  return resolveReady;
}

function installScopedSettingsBridge(): void {
  if (window.freeanimaScopedSettings) return;
  const backend = createWebScopedBackend();
  window.freeanimaScopedSettings = {
    load: (scope: SettingsStorageScope) => backend.load(scope),
    save: async (scope: SettingsStorageScope, value: unknown) => {
      await backend.save(scope, value);
    },
    test: async (scope: SettingsStorageScope, value: unknown): Promise<unknown> => {
      if (scope.kind === "kv" && scope.id === "hub") {
        const raw = value as { hubUrl: string; remoteAuthToken: string };
        await testWebHubConnection(raw.hubUrl, raw.remoteAuthToken);
        return;
      }
      if (scope.kind === "kv" && scope.id === "debug") {
        await backend.save(scope, value);
        const { sendSentryTestEvent } = await import("@freeanima/shell-ui/sentry-test");
        await sendSentryTestEvent();
        return;
      }
      return;
    },
  };
}

function redirectToHubSetupIfNeeded(): void {
  if (!webNeedsHubSetupFromConfig()) return;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const setupPath = base ? `${base}/setup` : "/setup";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === setupPath || path.endsWith("/setup")) return;
  const next = `${setupPath}${window.location.search}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}

async function fetchWebUiConfig(): Promise<WebUiConfigJson | null> {
  try {
    const configPath = `${import.meta.env.BASE_URL}config.json`.replace(/\/{2,}/g, "/");
    const res = await fetch(configPath, { cache: "no-store" });
    if (!res.ok) return null;
    return parseWebUiConfigJson(await res.json());
  } catch {
    return null;
  }
}

function applyWebUiConfig(cfg: WebUiConfigJson | null): string {
  if (!cfg) return (__WEB_DEFAULT_HUB_URL__ || "http://127.0.0.1:2658").replace(/\/$/, "");
  const meta: NonNullable<Window["__freeanimaWebUiConfig"]> = {};
  if (cfg.layout_mode) meta.layout_mode = cfg.layout_mode;
  if (cfg.ui_version) meta.ui_version = cfg.ui_version;
  if (cfg.min_shell_version) meta.min_shell_version = cfg.min_shell_version;
  window.__freeanimaWebUiConfig = meta;
  const runtimeHub = cfg.hub_url?.trim().replace(/\/$/, "");
  return runtimeHub || (__WEB_DEFAULT_HUB_URL__ || "http://127.0.0.1:2658").replace(/\/$/, "");
}

async function bootstrapElectronBridge(defaultHubUrl: string, defaultToken: string): Promise<void> {
  if (window.satelliteShell?.isElectron) return;
  window.satelliteShell = createWebShellStub();
  if (!window.freeanimaScopedSettings) installScopedSettingsBridge();
  const backend = createWebScopedBackend();
  const raw = await backend.load(HUB_SETTINGS_SCOPE);
  const parsed = parseShellClientConfig(raw);
  if (parsed) {
    installWebShellFromPrefs(parsed.hubUrl, parsed.remoteAuthToken);
  } else if (defaultHubUrl) {
    window.satelliteShell = buildWebShellFromRaw(defaultHubUrl, defaultToken);
  }
}

async function bootstrapCapacitorBridge(): Promise<void> {
  await waitForCapacitorBridge();
  window.satelliteShell = createMobileShellStub();
  const hubUrl = await loadHubUrl();
  const remoteAuthToken = await loadRemoteAuthToken();
  if (hubUrl) {
    window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken ?? "");
  }
}

async function bootstrapWebBridge(defaultHubUrl: string, defaultToken: string): Promise<void> {
  installScopedSettingsBridge();
  window.satelliteShell = createWebShellStub();
  seedWebHubPrefsIfEmpty(defaultHubUrl, defaultToken);
  const backend = createWebScopedBackend();
  const raw = await backend.load(HUB_SETTINGS_SCOPE);
  const parsed = parseShellClientConfig(raw);
  if (parsed) {
    installWebShellFromPrefs(parsed.hubUrl, parsed.remoteAuthToken);
  } else if (defaultHubUrl) {
    window.satelliteShell = buildWebShellFromRaw(defaultHubUrl, defaultToken);
  }
  redirectToHubSetupIfNeeded();
}

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.shellUi = "1";

  try {
    const cfg = await fetchWebUiConfig();
    const defaultHubUrl = applyWebUiConfig(cfg);
    const defaultToken = __WEB_DEFAULT_REMOTE_AUTH_TOKEN__ || "";

    if (window.satelliteShell?.isElectron) {
      await bootstrapElectronBridge(defaultHubUrl, defaultToken);
    } else if (isCapacitorRuntime()) {
      await bootstrapCapacitorBridge();
    } else {
      await bootstrapWebBridge(defaultHubUrl, defaultToken);
    }
  } finally {
    finish();
  }
}

void bootstrapShellBridge().catch((err) => {
  console.error("[shell-bridge]", err);
});

export const WEB_SHELL_BRIDGE_MODULE = true;

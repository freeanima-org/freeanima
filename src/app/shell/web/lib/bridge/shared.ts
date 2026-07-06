import type { WebUiConfigJson } from "@freeanima/shell-sdk/web-ui-config";

export type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
  __freeanimaWebUiConfig?: Pick<
    WebUiConfigJson,
    "layout_mode" | "ui_version" | "min_shell_version"
  >;
};

export type ScopedSettingsBridge = import("@freeanima/shell-sdk/settings").ScopedSettingsBackend & {
  test(
    scope: import("@freeanima/shell-sdk/settings").SettingsStorageScope,
    value: unknown,
  ): Promise<unknown>;
};

declare global {
  interface Window {
    freeanimaScopedSettings?: ScopedSettingsBridge;
    __freeanimaWebUiConfig?: Pick<
      WebUiConfigJson,
      "layout_mode" | "ui_version" | "min_shell_version"
    >;
  }

  const __WEB_DEFAULT_HUB_URL__: string;
  const __WEB_DEFAULT_REMOTE_AUTH_TOKEN__: string;
}

export function isCapacitorRuntime(): boolean {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() ?? cap);
}

export function installShellBridgeReady(): () => void {
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

export async function fetchWebUiConfig(): Promise<WebUiConfigJson | null> {
  try {
    const configPath = `${import.meta.env.BASE_URL}config.json`.replace(/\/{2,}/g, "/");
    const res = await fetch(configPath, { cache: "no-store" });
    if (!res.ok) return null;
    const { parseWebUiConfigJson } = await import("@freeanima/shell-sdk/web-ui-config");
    return parseWebUiConfigJson(await res.json());
  } catch {
    return null;
  }
}

export type WebUiBootstrapConfig = {
  hubUrl: string;
  authToken: string;
};

export function applyWebUiConfig(cfg: WebUiConfigJson | null): WebUiBootstrapConfig {
  const fallback = (
    typeof __WEB_DEFAULT_HUB_URL__ !== "undefined"
      ? __WEB_DEFAULT_HUB_URL__
      : "http://127.0.0.1:2658"
  ).replace(/\/$/, "");
  if (!cfg) return { hubUrl: fallback, authToken: "" };
  const meta: NonNullable<Window["__freeanimaWebUiConfig"]> = {};
  if (cfg.layout_mode) meta.layout_mode = cfg.layout_mode;
  if (cfg.ui_version) meta.ui_version = cfg.ui_version;
  if (cfg.min_shell_version) meta.min_shell_version = cfg.min_shell_version;
  window.__freeanimaWebUiConfig = meta;
  const runtimeHub = cfg.hub_url?.trim().replace(/\/$/, "");
  const authToken = cfg.auth_token?.trim() ?? "";
  return { hubUrl: runtimeHub || fallback, authToken };
}

export function readDefaultRemoteAuthToken(): string {
  return typeof __WEB_DEFAULT_REMOTE_AUTH_TOKEN__ !== "undefined"
    ? __WEB_DEFAULT_REMOTE_AUTH_TOKEN__
    : "";
}

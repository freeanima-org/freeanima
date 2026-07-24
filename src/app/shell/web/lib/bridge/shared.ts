import type { WebUiConfigJson } from "@freeanima/frontend/portal-sdk/web-ui-config";

export type ShellBridgeWindow = Window & {
  __freeanimaShellBridge?: { ready: Promise<void> };
  __freeanimaWebUiConfig?: Pick<
    WebUiConfigJson,
    "layout_mode" | "ui_version" | "web_build" | "min_shell_version"
  >;
};

export type ScopedSettingsBridge =
  import("@freeanima/frontend/portal-sdk/settings").ScopedSettingsBackend & {
    test(
      scope: import("@freeanima/frontend/portal-sdk/settings").SettingsStorageScope,
      value: unknown,
    ): Promise<unknown>;
  };

declare global {
  interface Window {
    freeanimaScopedSettings?: ScopedSettingsBridge;
    __freeanimaWebUiConfig?: Pick<
      WebUiConfigJson,
      "layout_mode" | "ui_version" | "web_build" | "min_shell_version"
    >;
  }

  const __WEB_DEFAULT_HABITAT_URL__: string;
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
    const { parseWebUiConfigJson } = await import("@freeanima/frontend/portal-sdk/web-ui-config");
    return parseWebUiConfigJson(await res.json());
  } catch {
    return null;
  }
}

export type WebUiBootstrapConfig = {
  habitatUrl: string;
  /** 空 habitat_url 或与页面 origin 相同时 true：用页面 origin */
  sameOrigin: boolean;
  remoteAuthToken?: string;
};

/** Web UI 默认 Habitat = 当前页面 origin（生产 Habitat 托管与 Vite 开发统一） */
export function applyWebUiConfig(cfg: WebUiConfigJson | null): WebUiBootstrapConfig {
  const pageOrigin = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  const compileFallback = (
    typeof __WEB_DEFAULT_HABITAT_URL__ !== "undefined" ? __WEB_DEFAULT_HABITAT_URL__ : ""
  ).replace(/\/$/, "");

  if (cfg) {
    const meta: NonNullable<Window["__freeanimaWebUiConfig"]> = {};
    if (cfg.layout_mode) meta.layout_mode = cfg.layout_mode;
    if (cfg.ui_version) meta.ui_version = cfg.ui_version;
    if (cfg.web_build) meta.web_build = cfg.web_build;
    if (cfg.min_shell_version) meta.min_shell_version = cfg.min_shell_version;
    window.__freeanimaWebUiConfig = meta;
  }

  const runtimeHabitatUrl = cfg?.habitat_url?.trim().replace(/\/$/, "") ?? "";
  const remoteAuthToken = cfg?.remote_auth_token?.trim() || undefined;

  if (!runtimeHabitatUrl || (pageOrigin && runtimeHabitatUrl === pageOrigin)) {
    return {
      habitatUrl: pageOrigin || runtimeHabitatUrl || compileFallback,
      sameOrigin: true,
      ...(remoteAuthToken ? { remoteAuthToken } : {}),
    };
  }

  return {
    habitatUrl: runtimeHabitatUrl,
    sameOrigin: false,
    ...(remoteAuthToken ? { remoteAuthToken } : {}),
  };
}

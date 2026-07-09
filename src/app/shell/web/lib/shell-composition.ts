import type { SettingsBinding } from "@freeanima/frontend/shell-sdk/settings";

import { createWebSettingsBindings } from "./settings-registry.ts";
import { createWebSettingsStores } from "./settings-stores.ts";

function isCapacitorRuntime(): boolean {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() ?? cap);
}

export type ShellRuntimeKind = "electron" | "capacitor" | "web";

export function detectShellRuntimeKind(): ShellRuntimeKind {
  if (window.satelliteShell?.isElectron) return "electron";
  if (window.satelliteShell?.isNativeShell || isCapacitorRuntime()) return "capacitor";
  return "web";
}

/** 按运行时壳类型解析 settings bindings（能力轴；布局由 layoutMode 独立决定） */
export async function resolveShellBindings(): Promise<SettingsBinding[]> {
  const kind = detectShellRuntimeKind();
  if (kind === "electron") {
    const [
      { createDesktopSettingsApis },
      { createDesktopSettingsBindings },
      { createDesktopSettingsStores },
    ] = await Promise.all([
      import("@freeanima/app/shell/desktop/spa/companion-settings-api.ts"),
      import("@freeanima/app/shell/desktop/spa/settings-registry.ts"),
      import("@freeanima/app/shell/desktop/lib/settings-stores.ts"),
    ]);
    const stores = createDesktopSettingsStores();
    const apis = createDesktopSettingsApis();
    return createDesktopSettingsBindings(stores, apis);
  }
  if (kind === "capacitor") {
    const [{ createMobileSettingsBindings }, { createMobileSettingsStores }] = await Promise.all([
      import("@freeanima/app/shell/mobile/lib/settings-registry.ts"),
      import("@freeanima/app/shell/mobile/lib/settings-stores.ts"),
    ]);
    const stores = createMobileSettingsStores();
    return createMobileSettingsBindings(stores);
  }
  const stores = createWebSettingsStores();
  return createWebSettingsBindings(stores);
}

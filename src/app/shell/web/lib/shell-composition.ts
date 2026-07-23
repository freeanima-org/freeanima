import type { SettingsBinding } from "@freeanima/frontend/shell-sdk/settings";
import {
  getShellKind,
  type ShellRuntimeKind,
} from "@freeanima/frontend/shell-sdk/shell-runtime.ts";
import { getShellBuildTarget } from "@freeanima/frontend/shell-sdk/shell-build-target.ts";

import { createWebSettingsBindings } from "./settings-registry.ts";
import { createWebSettingsStores } from "./settings-stores.ts";

export type { ShellRuntimeKind };
export { getShellKind };

/** 按运行时壳类型解析 settings bindings（壳子维；布局由 layoutMode 独立决定） */
export async function resolveShellBindings(): Promise<SettingsBinding[]> {
  const kind = getShellKind();
  const buildTarget = getShellBuildTarget();

  if (kind === "tauri" && buildTarget === "mobile") {
    const [{ createMobileSettingsBindings }, { createMobileSettingsStores }] = await Promise.all([
      import("@freeanima/app/shell/tauri/lib/mobile-settings-registry.ts"),
      import("@freeanima/app/shell/tauri/lib/mobile-settings-stores.ts"),
    ]);
    const stores = createMobileSettingsStores();
    return createMobileSettingsBindings(stores);
  }

  // 桌面伴侣设置仅随 desktop 壳产物打包（getShellBuildTarget）
  if (buildTarget === "desktop" || (kind === "tauri" && buildTarget !== "mobile")) {
    const [
      { createDesktopSettingsApis },
      { createDesktopSettingsBindings },
      { createDesktopSettingsStores },
    ] = await Promise.all([
      import("@freeanima/app/shell/tauri/spa/companion-settings-api.ts"),
      import("@freeanima/app/shell/tauri/spa/settings-registry.ts"),
      import("@freeanima/app/shell/tauri/lib/desktop-settings-stores.ts"),
    ]);
    const stores = createDesktopSettingsStores();
    const apis = createDesktopSettingsApis();
    return createDesktopSettingsBindings(stores, apis);
  }

  const stores = createWebSettingsStores();
  return createWebSettingsBindings(stores);
}

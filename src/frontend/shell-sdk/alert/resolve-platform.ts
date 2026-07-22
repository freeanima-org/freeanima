import { getShellBuildTarget } from "../shell-build-target.ts";
import { isTauriRuntime } from "../tauri-runtime.ts";
import type { AlertBackend, AlertPlatform } from "./types.ts";

function runtimeWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

/** @deprecated Capacitor 已移除；恒为 false，保留 API 避免大范围改动。 */
export function isCapacitorShellRuntime(): boolean {
  return false;
}

/** 设置页「平台」展示：backend 已正确注册时沿用；web 时按壳能力再判一次。 */
export function resolveAlertDisplayPlatform(
  backend: AlertBackend | null | undefined,
): AlertPlatform {
  const buildTarget = getShellBuildTarget();
  if (buildTarget === "desktop") return "desktop";
  if (buildTarget === "mobile") return "mobile";

  const w = runtimeWindow();
  const shell = w?.satelliteShell;
  if (backend?.platform && backend.platform !== "web") {
    if (
      backend.platform === "mobile" &&
      (shell?.isTauri || isTauriRuntime() || typeof shell?.showNativeAlert === "function")
    ) {
      return "desktop";
    }
    return backend.platform;
  }
  if (typeof shell?.showNativeAlert === "function") {
    return shell.primaryInput === "touch" ? "mobile" : "desktop";
  }
  if (shell?.isTauri || isTauriRuntime()) {
    return shell?.primaryInput === "touch" ? "mobile" : "desktop";
  }
  return backend?.platform ?? "web";
}

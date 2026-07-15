import {
  isCapacitorNativePlatform,
  isMobileCapacitorShellCandidate,
} from "../capacitor-runtime.ts";
import type { AlertBackend, AlertPlatform } from "./types.ts";

/** 与壳层 Alert 注册逻辑一致：用于设置页展示与兜底注册判断（不跟手机 UA）。 */
export function isCapacitorShellRuntime(): boolean {
  return Boolean(
    window.satelliteShell?.isNativeShell ||
    isCapacitorNativePlatform() ||
    isMobileCapacitorShellCandidate(),
  );
}

/** 设置页「平台」展示：backend 已正确注册时沿用；web 时按壳能力再判一次。 */
export function resolveAlertDisplayPlatform(
  backend: AlertBackend | null | undefined,
): AlertPlatform {
  if (backend?.platform && backend.platform !== "web") {
    return backend.platform;
  }
  if (window.satelliteShell?.isElectron) return "desktop";
  if (isCapacitorShellRuntime()) return "mobile";
  return backend?.platform ?? "web";
}

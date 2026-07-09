import { Capacitor } from "@capacitor/core";

import {
  isCapacitorNativePlatform,
  isMobileCapacitorShellCandidate,
} from "@freeanima/frontend/shell-sdk/capacitor-runtime.ts";

export const CAPACITOR_BRIDGE_TIMEOUT_MS = 10_000;

/** 等待 Capacitor 原生插件可用；Web 环境立即返回。 */
export async function waitForCapacitorBridge(
  timeoutMs = CAPACITOR_BRIDGE_TIMEOUT_MS,
): Promise<void> {
  if (!Capacitor.isNativePlatform() && !isMobileCapacitorShellCandidate()) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (Capacitor.isPluginAvailable("Preferences")) return;
    const prefs = (
      window as Window & {
        Capacitor?: { Plugins?: { Preferences?: { get?: unknown } } };
      }
    ).Capacitor?.Plugins?.Preferences;
    if (prefs?.get) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  if (Capacitor.isNativePlatform() || isCapacitorNativePlatform()) {
    throw new Error("Capacitor 原生桥接初始化超时");
  }
}

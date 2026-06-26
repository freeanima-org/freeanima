import { Capacitor } from "@capacitor/core";

export const CAPACITOR_BRIDGE_TIMEOUT_MS = 10_000;

/** 等待 Capacitor 原生插件可用；Web 环境立即返回。 */
export async function waitForCapacitorBridge(
  timeoutMs = CAPACITOR_BRIDGE_TIMEOUT_MS,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (Capacitor.isPluginAvailable("Preferences")) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error("Capacitor 原生桥接初始化超时");
}

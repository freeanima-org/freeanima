import {
  hasCapacitorLocalNotificationsBridge,
  hasCapacitorPreferencesBridge,
  isMobileCapacitorBridgeExpected,
} from "./capacitor-plugins.ts";

export const CAPACITOR_BRIDGE_TIMEOUT_MS = 10_000;

function bridgeReady(): boolean {
  return hasCapacitorPreferencesBridge() && hasCapacitorLocalNotificationsBridge();
}

/** 等待 Capacitor 原生插件可用；Web 环境立即返回。 */
export async function waitForCapacitorBridge(
  timeoutMs = CAPACITOR_BRIDGE_TIMEOUT_MS,
): Promise<void> {
  if (!isMobileCapacitorBridgeExpected()) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (bridgeReady()) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  if (isMobileCapacitorBridgeExpected()) {
    const missing: string[] = [];
    if (!hasCapacitorPreferencesBridge()) missing.push("Preferences");
    if (!hasCapacitorLocalNotificationsBridge()) missing.push("LocalNotifications");
    throw new Error(`Capacitor 原生桥接初始化超时（缺少 ${missing.join("、")}）`);
  }
}

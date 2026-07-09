import {
  hasCapacitorNativeBridge,
  isMobileCapacitorBridgeExpected,
  pinCapacitorNativeBridge,
} from "./capacitor-plugins.ts";

export const CAPACITOR_BRIDGE_TIMEOUT_MS = 3_000;

/** 等待 Capacitor 原生桥（nativePromise）；Web 环境立即返回。 */
export async function waitForCapacitorBridge(
  timeoutMs = CAPACITOR_BRIDGE_TIMEOUT_MS,
): Promise<void> {
  if (!isMobileCapacitorBridgeExpected()) return;

  pinCapacitorNativeBridge();
  if (hasCapacitorNativeBridge()) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    pinCapacitorNativeBridge();
    if (hasCapacitorNativeBridge()) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  if (isMobileCapacitorBridgeExpected()) {
    throw new Error("Capacitor 原生桥接初始化超时（缺少 nativePromise）");
  }
}

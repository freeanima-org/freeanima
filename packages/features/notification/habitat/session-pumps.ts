import {
  getSessionPumps,
  setSessionPumpsForTest,
} from "@freeanima/capabilities/ports/session-pumps.ts";

export function notificationSessionPumps(): Map<string, AbortController> {
  try {
    return getSessionPumps();
  } catch {
    throw new Error("Notification session pumps not initialized");
  }
}

/** @internal 测试隔离 */
export function setNotificationSessionPumpsForTest(
  pumps: Map<string, AbortController> | null,
): void {
  setSessionPumpsForTest(pumps);
}

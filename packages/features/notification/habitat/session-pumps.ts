let sessionPumps: Map<string, AbortController> | null = null;

/** Called once from platform ws-server when Habitat RPC session handlers are created. */
export function bindNotificationSessionPumps(pumps: Map<string, AbortController>): void {
  sessionPumps = pumps;
}

export function notificationSessionPumps(): Map<string, AbortController> {
  if (!sessionPumps) {
    throw new Error("Notification session pumps not initialized");
  }
  return sessionPumps;
}

/** @internal */
export function setNotificationSessionPumpsForTest(
  pumps: Map<string, AbortController> | null,
): void {
  sessionPumps = pumps;
}

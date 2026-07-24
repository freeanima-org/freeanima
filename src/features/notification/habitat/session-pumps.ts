let sessionPumps: Map<string, AbortController> | null = null;

export function setNotificationSessionPumpsForTest(
  pumps: Map<string, AbortController> | null,
): void {
  sessionPumps = pumps;
}

export function notificationSessionPumps(): Map<string, AbortController> {
  if (!sessionPumps) {
    sessionPumps = new Map();
  }
  return sessionPumps;
}

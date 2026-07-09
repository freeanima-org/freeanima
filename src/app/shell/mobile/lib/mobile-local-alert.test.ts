import { describe, expect, test } from "bun:test";

import { mapLocalNotificationPermission, tagToNotificationId } from "./mobile-local-alert.ts";

describe("mobile-local-alert", () => {
  test("mapLocalNotificationPermission maps Capacitor display states", () => {
    expect(mapLocalNotificationPermission("granted")).toBe("granted");
    expect(mapLocalNotificationPermission("denied")).toBe("denied");
    expect(mapLocalNotificationPermission("prompt")).toBe("default");
    expect(mapLocalNotificationPermission(undefined)).toBe("unsupported");
  });

  test("tagToNotificationId is stable and positive", () => {
    const a = tagToNotificationId("pomodoro:session-1:work");
    const b = tagToNotificationId("pomodoro:session-1:work");
    const c = tagToNotificationId("pomodoro:session-2:work");
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
    expect(c).not.toBe(a);
  });
});

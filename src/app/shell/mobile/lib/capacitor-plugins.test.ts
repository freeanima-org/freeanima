import { afterEach, describe, expect, it } from "bun:test";

import {
  hasCapacitorLocalNotificationsBridge,
  hasCapacitorPreferencesBridge,
  readWindowLocalNotificationsPlugin,
  readWindowPreferencesPlugin,
} from "./capacitor-plugins.ts";

describe("capacitor-plugins", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("无 window.Capacitor 时插件不可用", () => {
    (globalThis as { window: Window }).window = {} as Window;
    expect(readWindowPreferencesPlugin()).toBeNull();
    expect(readWindowLocalNotificationsPlugin()).toBeNull();
    expect(hasCapacitorPreferencesBridge()).toBe(false);
    expect(hasCapacitorLocalNotificationsBridge()).toBe(false);
  });

  it("读取 window.Capacitor.Plugins 原生桥", () => {
    const prefs = {
      get: async () => ({ value: "hub" }),
      set: async () => {},
    };
    const notifications = {
      checkPermissions: async () => ({ display: "granted" }),
      requestPermissions: async () => ({ display: "granted" }),
      schedule: async () => {},
    };
    (globalThis as { window: Window }).window = {
      Capacitor: { Plugins: { Preferences: prefs, LocalNotifications: notifications } },
    } as unknown as Window;

    expect(readWindowPreferencesPlugin()).toBe(prefs);
    expect(readWindowLocalNotificationsPlugin()).toBe(notifications);
    expect(hasCapacitorPreferencesBridge()).toBe(true);
    expect(hasCapacitorLocalNotificationsBridge()).toBe(true);
  });
});

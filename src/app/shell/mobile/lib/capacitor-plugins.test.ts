import { afterEach, describe, expect, it } from "bun:test";

import {
  createLocalNotificationsApiFromNativeBridge,
  createPreferencesApiFromNativeBridge,
  hasCapacitorNativeBridge,
  pinCapacitorNativeBridge,
} from "./capacitor-plugins.ts";

describe("capacitor-plugins", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("无 window.Capacitor 时原生桥不可用", () => {
    (globalThis as { window: Window }).window = {} as Window;
    expect(hasCapacitorNativeBridge()).toBe(false);
    expect(createPreferencesApiFromNativeBridge()).toBeNull();
    expect(createLocalNotificationsApiFromNativeBridge()).toBeNull();
  });

  it("通过 nativePromise 调用 Preferences / LocalNotifications", async () => {
    const calls: string[] = [];
    (globalThis as { window: Window }).window = {
      Capacitor: {
        nativePromise: async (plugin: string, method: string) => {
          calls.push(`${plugin}.${method}`);
          if (plugin === "Preferences" && method === "get") {
            return { value: "hub" };
          }
          if (plugin === "LocalNotifications" && method === "checkPermissions") {
            return { display: "granted" };
          }
          return {};
        },
        getPlatform: () => "android",
      },
    } as unknown as Window;

    pinCapacitorNativeBridge();
    expect(hasCapacitorNativeBridge()).toBe(true);

    const prefs = createPreferencesApiFromNativeBridge();
    expect(prefs).not.toBeNull();
    await expect(prefs?.get({ key: "freeanima.hubUrl" })).resolves.toEqual({ value: "hub" });

    const notifications = createLocalNotificationsApiFromNativeBridge();
    expect(notifications).not.toBeNull();
    await expect(notifications?.checkPermissions()).resolves.toEqual({ display: "granted" });
    expect(calls).toContain("Preferences.get");
    expect(calls).toContain("LocalNotifications.checkPermissions");
  });
});

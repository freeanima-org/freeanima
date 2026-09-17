import { describe, expect, test } from "bun:test";

import { desktopGeneralSettingsSection, habitatSettingsSection } from "./habitat-section.ts";

describe("habitat settings sections", () => {
  test("habitat section exposes 连接栖息地 fields on desktop and mobile", () => {
    expect(habitatSettingsSection.title).toBe("连接");
    expect(habitatSettingsSection.platforms.mobile?.kind).toBe("form");
    const desktop = habitatSettingsSection.platforms.desktop;
    expect(desktop?.kind).toBe("form");
    if (desktop?.kind !== "form") return;
    const keys = desktop.fields.items.map((item) => item.key);
    expect(keys).toContain("habitatUrl");
    expect(keys).toContain("remoteAuthToken");
    expect(keys).not.toContain("launchAtLogin");
  });

  test("desktop general section includes launchAtLogin", () => {
    expect(desktopGeneralSettingsSection.title).toBe("连接");
    const desktop = desktopGeneralSettingsSection.platforms.desktop;
    expect(desktop?.kind).toBe("form");
    if (desktop?.kind !== "form") return;
    const keys = desktop.fields.items.map((item) => item.key);
    expect(keys).toContain("launchAtLogin");
    expect(keys).toContain("habitatUrl");
  });

  test("habitat zod allows empty remoteAuthToken", () => {
    const desktop = habitatSettingsSection.platforms.desktop;
    expect(desktop?.kind).toBe("form");
    if (desktop?.kind !== "form") return;
    const parsed = desktop.fields.zodSchema.safeParse({
      habitatUrl: "http://192.168.1.10:2658",
      remoteAuthToken: "",
    });
    expect(parsed.success).toBe(true);
  });
});

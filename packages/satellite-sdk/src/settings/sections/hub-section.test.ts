import { describe, expect, test } from "bun:test";

import { desktopGeneralSettingsSection, hubSettingsSection } from "./hub-section.ts";

describe("hub settings sections", () => {
  test("hub section exposes Hub 连接 fields on desktop and mobile", () => {
    expect(hubSettingsSection.title).toBe("通用");
    expect(hubSettingsSection.platforms.mobile?.kind).toBe("form");
    const desktop = hubSettingsSection.platforms.desktop;
    expect(desktop?.kind).toBe("form");
    if (desktop?.kind !== "form") return;
    const keys = desktop.fields.items.map((item) => item.key);
    expect(keys).toContain("hubUrl");
    expect(keys).toContain("remoteAuthToken");
    expect(keys).not.toContain("launchAtLogin");
  });

  test("desktop general section includes launchAtLogin", () => {
    expect(desktopGeneralSettingsSection.title).toBe("通用");
    const desktop = desktopGeneralSettingsSection.platforms.desktop;
    expect(desktop?.kind).toBe("form");
    if (desktop?.kind !== "form") return;
    const keys = desktop.fields.items.map((item) => item.key);
    expect(keys).toContain("launchAtLogin");
    expect(keys).toContain("hubUrl");
  });
});

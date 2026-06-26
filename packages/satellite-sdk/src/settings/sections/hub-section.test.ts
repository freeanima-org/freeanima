import { describe, expect, test } from "bun:test";

import { desktopGeneralSettingsSection, hubSettingsSection } from "./hub-section.ts";

describe("hub settings sections", () => {
  test("mobile uses 通用 title", () => {
    expect(hubSettingsSection.title).toBe("通用");
    expect(hubSettingsSection.platforms.mobile?.kind).toBe("form");
    expect(hubSettingsSection.platforms.desktop).toBeUndefined();
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

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { applyExtSettingsToPortalShell } from "./portal-shell.ts";

describe("applyExtSettingsToPortalShell", () => {
  beforeEach(() => {
    (globalThis as { window?: Window }).window = {
      portalShell: undefined,
    } as unknown as Window;
  });

  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  test("写入 habitatUrl 与 Bearer token", () => {
    applyExtSettingsToPortalShell({
      habitat_url: "http://127.0.0.1:12658/",
      auth_token: "tok-abc",
    });
    expect(window.portalShell?.habitatUrl).toBe("http://127.0.0.1:12658");
    expect(window.portalShell?.habitatWsUrl).toContain("ws://127.0.0.1:12658");
    expect(window.portalShell?.remoteAuth?.token).toBe("tok-abc");
  });

  test("空 URL 清空 shell", () => {
    applyExtSettingsToPortalShell({
      habitat_url: "http://127.0.0.1:12658",
      auth_token: "tok",
    });
    applyExtSettingsToPortalShell({ habitat_url: "", auth_token: "" });
    expect(window.portalShell?.habitatUrl).toBe("");
    expect(window.portalShell?.remoteAuth).toBeUndefined();
  });
});

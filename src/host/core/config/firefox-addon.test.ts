import { describe, expect, test } from "bun:test";
import {
  FIREFOX_ADDON_ID,
  buildFirefoxAddonUpdatesJson,
  resolveFirefoxAddonVersion,
} from "./firefox-addon.ts";

describe("resolveFirefoxAddonVersion", () => {
  test("maps canary stamp to UTC minutes 4th segment (AMO ≤9 digits)", () => {
    expect(resolveFirefoxAddonVersion("0.9.2-canary+202608121035")).toBe("0.9.2.29775515");
  });

  test("maps local stamp to UTC minutes", () => {
    expect(resolveFirefoxAddonVersion("0.9.2-local+202601010000")).toBe("0.9.2.29453760");
  });

  test("release semver unchanged", () => {
    expect(resolveFirefoxAddonVersion("0.9.2")).toBe("0.9.2");
    expect(resolveFirefoxAddonVersion("v0.9.2")).toBe("0.9.2");
  });

  test("each segment has at most 9 digits", () => {
    const v = resolveFirefoxAddonVersion("0.11.0-canary+202608130345");
    for (const part of v.split(".")) {
      expect(part.length).toBeLessThanOrEqual(9);
      expect(part).toMatch(/^(0|[1-9]\d{0,8})$/);
    }
  });

  test("rejects garbage", () => {
    expect(() => resolveFirefoxAddonVersion("not-a-version")).toThrow();
  });
});

describe("buildFirefoxAddonUpdatesJson", () => {
  test("includes gecko id and canary xpi link", () => {
    expect(FIREFOX_ADDON_ID).toBe("extension@freeanima.com");
    const raw = buildFirefoxAddonUpdatesJson("0.9.2.29775515");
    const json = JSON.parse(raw) as {
      addons: Record<string, { updates: Array<{ version: string; update_link: string }> }>;
    };
    expect(json.addons[FIREFOX_ADDON_ID]?.updates[0]?.version).toBe("0.9.2.29775515");
    expect(json.addons[FIREFOX_ADDON_ID]?.updates[0]?.update_link).toContain(
      "releases/download/canary/freeanima-browser-extension-firefox.xpi",
    );
  });
});

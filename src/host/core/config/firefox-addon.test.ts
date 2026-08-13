import { describe, expect, test } from "bun:test";
import {
  FIREFOX_ADDON_ID,
  buildFirefoxAddonUpdatesJson,
  resolveFirefoxAddonVersion,
} from "./firefox-addon.ts";

describe("resolveFirefoxAddonVersion", () => {
  test("strips canary stamp into 4th segment", () => {
    expect(resolveFirefoxAddonVersion("0.9.2-canary+202608121035")).toBe("0.9.2.202608121035");
  });

  test("strips local stamp", () => {
    expect(resolveFirefoxAddonVersion("0.9.2-local+202601010000")).toBe("0.9.2.202601010000");
  });

  test("release semver unchanged", () => {
    expect(resolveFirefoxAddonVersion("0.9.2")).toBe("0.9.2");
    expect(resolveFirefoxAddonVersion("v0.9.2")).toBe("0.9.2");
  });

  test("rejects garbage", () => {
    expect(() => resolveFirefoxAddonVersion("not-a-version")).toThrow();
  });
});

describe("buildFirefoxAddonUpdatesJson", () => {
  test("includes gecko id and canary xpi link", () => {
    const raw = buildFirefoxAddonUpdatesJson("0.9.2.202608121035");
    const json = JSON.parse(raw) as {
      addons: Record<string, { updates: Array<{ version: string; update_link: string }> }>;
    };
    expect(json.addons[FIREFOX_ADDON_ID]?.updates[0]?.version).toBe("0.9.2.202608121035");
    expect(json.addons[FIREFOX_ADDON_ID]?.updates[0]?.update_link).toContain(
      "releases/download/canary/freeanima-browser-extension-firefox.xpi",
    );
  });
});

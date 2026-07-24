import { describe, expect, it } from "bun:test";

import {
  ANDROID_VERSION_CODE_GENERATION_FLOOR,
  computeAndroidVersionCode,
} from "./android-version-code.ts";
import { formatCanaryVersion } from "./canary-version.ts";
import { resolveBuildVersionFromEnv } from "./resolve-build-version.ts";
import { resolveDesktopShellIdentity, resolveMobileShellIdentity } from "./shell-identity.ts";

describe("formatCanaryVersion", () => {
  it("formats nextVersion-canary+UTC YYYYMMDDHHmm", () => {
    const now = new Date(Date.UTC(2026, 8, 12, 18, 23)); // 2026-09-12T18:23Z
    expect(formatCanaryVersion("1.0.0", now)).toBe("1.0.0-canary+202609121823");
    expect(formatCanaryVersion("v0.9.1", now)).toBe("0.9.1-canary+202609121823");
  });
});

describe("resolveBuildVersionFromEnv", () => {
  it("prefers FREEANIMA_BUILD_VERSION and strips leading v", () => {
    expect(
      resolveBuildVersionFromEnv(undefined, {
        FREEANIMA_BUILD_VERSION: "v1.2.3-canary+202601010000",
      }),
    ).toBe("1.2.3-canary+202601010000");
  });
});

describe("shell-identity", () => {
  it("keeps release/canary on production identity", () => {
    expect(resolveDesktopShellIdentity("release").appId).toBe("com.freeanima.portal");
    expect(resolveDesktopShellIdentity("canary").productName).toBe("FreeAnima");
    expect(resolveMobileShellIdentity("release").applicationId).toBe("com.freeanima.portal");
    expect(resolveMobileShellIdentity("canary").appName).toBe("FreeAnima");
  });

  it("uses separate identity for dev", () => {
    expect(resolveDesktopShellIdentity("dev")).toEqual({
      appId: "com.freeanima.portal.dev",
      productName: "FreeAnima Dev",
      executableName: "FreeAnima-Dev",
    });
    expect(resolveMobileShellIdentity("dev")).toEqual({
      applicationId: "com.freeanima.portal.dev",
      appName: "FreeAnima Dev",
    });
  });
});

describe("computeAndroidVersionCode", () => {
  it("uses base code for plain semver without channel", () => {
    expect(computeAndroidVersionCode("1.2.3")).toBe(10203);
  });

  it("uses generation floor + clock for release channel", () => {
    const now = new Date(Date.UTC(2026, 6, 16, 2, 16)); // 2026-07-16T02:16Z
    const code = computeAndroidVersionCode("0.9.0", { channel: "release", now });
    expect(code).toBeGreaterThan(ANDROID_VERSION_CODE_GENERATION_FLOOR);
    expect(code % 2).toBe(1); // release bit
  });

  it("embeds timestamp for canary/dev above generation floor", () => {
    const now = new Date(Date.UTC(2026, 6, 16, 2, 16)); // 2026-07-16T02:16Z
    const code = computeAndroidVersionCode("0.9.1-canary+202607160216", {
      channel: "canary",
      now,
    });
    expect(code).toBeGreaterThan(ANDROID_VERSION_CODE_GENERATION_FLOOR);
    expect(code % 2).toBe(0);
  });

  it("keeps canary monotonic across the old 1e6-minute wrap", () => {
    const beforeWrap = computeAndroidVersionCode("0.8.5-canary+202511250000", {
      channel: "canary",
    });
    const afterWrap = computeAndroidVersionCode("0.8.5-canary+202607180000", {
      channel: "canary",
    });
    expect(afterWrap).toBeGreaterThan(beforeWrap);
    // 旧公式回绕后 after < before；新公式须仍高于旧包天花板（~base*1e6+1e6）
    expect(afterWrap).toBeGreaterThan(805_999_999);
  });

  it("allows release to supersede canary at the same build minute", () => {
    const now = new Date(Date.UTC(2026, 6, 18, 12, 0));
    const canary = computeAndroidVersionCode("0.9.1-canary+202607181200", {
      channel: "canary",
      now,
    });
    const release = computeAndroidVersionCode("0.9.1", { channel: "release", now });
    expect(release).toBe(canary + 1);
  });

  it("prefers +YYYYMMDDHHmm over wall-clock now", () => {
    const laterWall = new Date(Date.UTC(2026, 6, 16, 10, 0));
    const fromStamp = computeAndroidVersionCode("0.9.1-canary+202607160848", {
      channel: "canary",
      now: laterWall,
    });
    const expected = computeAndroidVersionCode("0.9.1-canary", {
      channel: "canary",
      now: new Date(Date.UTC(2026, 6, 16, 8, 48)),
    });
    expect(fromStamp).toBe(expected);
    expect(fromStamp).toBeLessThan(
      computeAndroidVersionCode("0.9.1-canary+202607160949", { channel: "canary" }),
    );
  });
});

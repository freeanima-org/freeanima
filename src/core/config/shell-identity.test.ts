import { describe, expect, it } from "bun:test";

import { computeAndroidVersionCode } from "./android-version-code.ts";
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
    expect(resolveDesktopShellIdentity("release").appId).toBe("org.freeanima.desktop");
    expect(resolveDesktopShellIdentity("canary").productName).toBe("FreeAnima Desktop");
    expect(resolveMobileShellIdentity("release").applicationId).toBe("org.freeanima.app");
    expect(resolveMobileShellIdentity("canary").appName).toBe("FreeAnima");
  });

  it("uses separate identity for dev", () => {
    expect(resolveDesktopShellIdentity("dev")).toEqual({
      appId: "org.freeanima.desktop.dev",
      productName: "FreeAnima Desktop Dev",
      executableName: "FreeAnima-Desktop-Dev",
    });
    expect(resolveMobileShellIdentity("dev")).toEqual({
      applicationId: "org.freeanima.app.dev",
      appName: "FreeAnima Dev",
    });
  });
});

describe("computeAndroidVersionCode", () => {
  it("uses base code for plain release semver", () => {
    expect(computeAndroidVersionCode("0.9.0", { channel: "release" })).toBe(900);
    expect(computeAndroidVersionCode("1.2.3")).toBe(10203);
  });

  it("embeds timestamp stamp for canary/dev", () => {
    const now = new Date(Date.UTC(2026, 6, 16, 2, 16)); // 2026-07-16T02:16Z
    const code = computeAndroidVersionCode("0.9.1-canary+202607160216", {
      channel: "canary",
      now,
    });
    expect(code).toBeGreaterThan(900_000_000);
    expect(String(code).startsWith("901")).toBe(true);
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

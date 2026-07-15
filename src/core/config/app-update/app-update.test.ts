import { describe, expect, it } from "bun:test";

import { matchReleaseAsset } from "./release-assets.ts";
import { resolvePackagedUpdate } from "./resolve-packaged-update.ts";
import { compareSemver, isSemverNewer, normalizeSemver } from "./semver.ts";

describe("semver", () => {
  it("normalizes and compares", () => {
    expect(normalizeSemver("v0.8.5")).toBe("0.8.5");
    expect(compareSemver("0.8.5", "0.8.4")).toBe(1);
    expect(compareSemver("0.8.5", "v0.8.5")).toBe(0);
    expect(isSemverNewer("0.9.0", "0.8.5")).toBe(true);
    expect(isSemverNewer("0.8.5", "0.8.5")).toBe(false);
  });
});

describe("matchReleaseAsset", () => {
  it("matches exact names", () => {
    const assets = [
      { name: "anima-linux-x64.tar.gz", browser_download_url: "https://example/a" },
      {
        name: "freeanima-desktop-windows-x64-setup.exe",
        browser_download_url: "https://example/d",
      },
    ];
    expect(matchReleaseAsset("standalone-linux-x64", assets)?.name).toBe("anima-linux-x64.tar.gz");
    expect(matchReleaseAsset("desktop-windows", assets)?.name).toBe(
      "freeanima-desktop-windows-x64-setup.exe",
    );
    expect(matchReleaseAsset("mobile-android", assets)).toBeNull();
  });
});

describe("resolvePackagedUpdate", () => {
  it("requires newer tag and matching asset", async () => {
    const release = {
      tag_name: "v0.9.0",
      prerelease: false,
      draft: false,
      html_url: "https://github.com/freeanima-org/freeanima/releases/tag/v0.9.0",
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url: "https://example.com/anima-linux-x64.tar.gz",
          size: 10,
        },
      ],
    };
    const fetchImpl = (async () =>
      new Response(JSON.stringify(release), { status: 200 })) as unknown as typeof fetch;

    const up = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      fetchOptions: { fetchImpl },
    });
    expect(up.available).toBe(true);
    if (up.available) {
      expect(up.assetUrl).toContain("anima-linux-x64.tar.gz");
      expect(up.remoteVersion).toBe("v0.9.0");
    }

    const same = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.9.0",
      fetchOptions: { fetchImpl },
    });
    expect(same).toEqual({ available: false, reason: "up_to_date", remoteVersion: "v0.9.0" });

    const noApk = await resolvePackagedUpdate({
      kind: "mobile-android",
      localVersion: "0.8.5",
      fetchOptions: { fetchImpl },
    });
    expect(noApk).toEqual({ available: false, reason: "no_asset", remoteVersion: "v0.9.0" });
  });
});

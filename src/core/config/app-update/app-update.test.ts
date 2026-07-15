import { describe, expect, it } from "bun:test";

import { commitsMatch, extractReleaseCommit, CANARY_RELEASE_TAG } from "./github-releases.ts";
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

describe("extractReleaseCommit / commitsMatch", () => {
  it("parses sha from target_commitish or body", () => {
    expect(extractReleaseCommit({ target_commitish: "abc1234def" })).toBe("abc1234def");
    expect(extractReleaseCommit({ target_commitish: "main" })).toBeUndefined();
    expect(extractReleaseCommit({ body: "Canary\n\nsha: deadbeefcafebabe\n" })).toBe(
      "deadbeefcafebabe",
    );
    expect(commitsMatch("deadbeef", "deadbeefcafebabe")).toBe(true);
    expect(commitsMatch("aaaa", "bbbb")).toBe(false);
  });
});

describe("resolvePackagedUpdate", () => {
  it("requires newer tag and matching asset on release track", async () => {
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
      channel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(up.available).toBe(true);
    if (up.available) {
      expect(up.assetUrl).toContain("anima-linux-x64.tar.gz");
      expect(up.remoteVersion).toBe("v0.9.0");
      expect(up.track).toBe("release");
    }

    const same = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.9.0",
      channel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(same).toEqual({
      available: false,
      reason: "up_to_date",
      remoteVersion: "v0.9.0",
      track: "release",
    });

    const noApk = await resolvePackagedUpdate({
      kind: "mobile-android",
      localVersion: "0.8.5",
      channel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(noApk).toEqual({
      available: false,
      reason: "no_asset",
      remoteVersion: "v0.9.0",
      track: "release",
    });
  });

  it("uses canary tag and commit comparison", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const release = {
      tag_name: CANARY_RELEASE_TAG,
      prerelease: true,
      draft: false,
      html_url: "https://github.com/freeanima-org/freeanima/releases/tag/canary",
      target_commitish: sha,
      body: `sha: ${sha}`,
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url: "https://example.com/canary.tgz",
        },
      ],
    };
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/releases/tags/canary")) {
        return new Response(JSON.stringify(release), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const newer = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "canary",
      localCommit: "aaaaaaaa",
      fetchOptions: { fetchImpl },
    });
    expect(newer.available).toBe(true);
    if (newer.available) expect(newer.remoteCommit).toBe(sha);

    const same = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "canary",
      localCommit: sha.slice(0, 12),
      fetchOptions: { fetchImpl },
    });
    expect(same.available).toBe(false);
    if (!same.available) expect(same.reason).toBe("up_to_date");
  });

  it("switch intent returns tip without semver gate", async () => {
    const release = {
      tag_name: "v0.8.5",
      prerelease: false,
      draft: false,
      html_url: "https://example/r",
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url: "https://example.com/a.tgz",
        },
      ],
    };
    const fetchImpl = (async () =>
      new Response(JSON.stringify(release), { status: 200 })) as unknown as typeof fetch;

    const sw = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.9.0",
      channel: "canary",
      intent: "switch",
      targetChannel: "release",
      fetchOptions: { fetchImpl },
    });
    expect(sw.available).toBe(true);
  });

  it("rejects dev channel", async () => {
    const r = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "dev",
    });
    expect(r).toEqual({ available: false, reason: "unsupported_channel" });
  });
});

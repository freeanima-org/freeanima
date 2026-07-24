import { describe, expect, it } from "bun:test";

import {
  compareCanaryVersion,
  extractReleaseVersion,
  isCanaryVersionNewer,
  isSemverNewer,
  matchReleaseAsset,
  resolvePackagedUpdate,
} from "./app-update.ts";

describe("portal-sdk app-update", () => {
  it("matches desktop asset and resolves update", async () => {
    expect(isSemverNewer("0.9.0", "0.8.5")).toBe(true);
    expect(
      matchReleaseAsset("desktop-windows", [
        {
          name: "freeanima-desktop-windows-x64-setup.exe",
          browser_download_url: "https://example/d",
        },
      ])?.name,
    ).toBe("freeanima-desktop-windows-x64-setup.exe");

    const release = {
      tag_name: "v0.9.0",
      prerelease: false,
      draft: false,
      html_url: "https://github.com/x/y/releases/tag/v0.9.0",
      assets: [
        {
          name: "freeanima-desktop-windows-x64-setup.exe",
          browser_download_url: "https://example.com/setup.exe",
        },
      ],
    };
    const fetchImpl = (async () =>
      new Response(JSON.stringify(release), { status: 200 })) as unknown as typeof fetch;
    const up = await resolvePackagedUpdate({
      kind: "desktop-windows",
      localVersion: "0.8.5",
      channel: "release",
      fetchImpl,
    });
    expect(up.available).toBe(true);
  });

  it("compares canary versions and extracts body version", async () => {
    expect(compareCanaryVersion("0.9.1-canary+202607160949", "0.9.1-canary+202607160848")).toBe(1);
    expect(extractReleaseVersion({ body: "version: `0.9.1-canary+202607160949`\n" })).toBe(
      "0.9.1-canary+202607160949",
    );

    const remoteVer = "0.9.1-canary+202607160949";
    const release = {
      tag_name: "canary",
      prerelease: true,
      draft: false,
      html_url: "https://github.com/x/y/releases/tag/canary",
      body: `version: \`${remoteVer}\`\nsha: \`deadbeef\`\n`,
      assets: [
        {
          name: "freeanima-mobile-android.apk",
          browser_download_url: "https://example.com/app.apk",
        },
      ],
    };
    const fetchImpl = (async (url: RequestInfo | URL) => {
      if (String(url).includes("/releases/tags/canary")) {
        return new Response(JSON.stringify(release), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const up = await resolvePackagedUpdate({
      kind: "mobile-android",
      localVersion: "0.9.1-canary+202607160848",
      channel: "canary",
      fetchImpl,
    });
    expect(up.available).toBe(true);
    if (up.available) expect(up.remoteVersion).toBe(remoteVer);

    const same = await resolvePackagedUpdate({
      kind: "mobile-android",
      localVersion: remoteVer,
      channel: "canary",
      fetchImpl,
    });
    expect(same.available).toBe(false);
    expect(isCanaryVersionNewer(remoteVer, remoteVer)).toBe(false);
  });
});

import { describe, expect, it } from "bun:test";

import { isSemverNewer, matchReleaseAsset, resolvePackagedUpdate } from "./app-update.ts";

describe("shell-sdk app-update", () => {
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
      fetchImpl,
    });
    expect(up.available).toBe(true);
  });
});

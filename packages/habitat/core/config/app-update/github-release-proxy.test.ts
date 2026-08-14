import { describe, expect, it } from "bun:test";

import {
  applyGithubReleaseProxy,
  isGithubReleaseProxyId,
  normalizeGithubReleaseProxy,
} from "./github-release-proxy.ts";
import { resolvePackagedUpdate } from "./resolve-packaged-update.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

describe("github-release-proxy", () => {
  it("normalizes unknown to none", () => {
    expect(normalizeGithubReleaseProxy(null)).toBe("none");
    expect(normalizeGithubReleaseProxy("bad")).toBe("none");
    expect(isGithubReleaseProxyId("ghproxy-net")).toBe(true);
    expect(isGithubReleaseProxyId("ghproxy")).toBe(false);
  });

  it("rewrites API and asset URLs; is idempotent", () => {
    const api = "https://api.github.com/repos/freeanima-org/freeanima/releases/latest";
    const asset =
      "https://github.com/freeanima-org/freeanima/releases/download/canary/anima-linux-x64.tar.gz";
    expect(applyGithubReleaseProxy(api, "none")).toBe(api);
    expect(applyGithubReleaseProxy(api, "ghproxy-net")).toBe(`https://ghproxy.net/${api}`);
    expect(applyGithubReleaseProxy(asset, "gh-proxy-com")).toBe(`https://gh-proxy.com/${asset}`);
    const once = applyGithubReleaseProxy(api, "ghfast-top");
    expect(applyGithubReleaseProxy(once, "ghfast-top")).toBe(once);
  });
});

describe("resolvePackagedUpdate with proxy", () => {
  it("fetches API via proxy and rewrites assetUrl", async () => {
    const release = {
      tag_name: "v0.9.0",
      prerelease: false,
      draft: false,
      html_url: "https://github.com/freeanima-org/freeanima/releases/tag/v0.9.0",
      assets: [
        {
          name: "anima-linux-x64.tar.gz",
          browser_download_url:
            "https://github.com/freeanima-org/freeanima/releases/download/v0.9.0/anima-linux-x64.tar.gz",
        },
      ],
    };
    const seen: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      seen.push(coerceString(url));
      return new Response(JSON.stringify(release), { status: 200 });
    }) as unknown as typeof fetch;

    const up = await resolvePackagedUpdate({
      kind: "standalone-linux-x64",
      localVersion: "0.8.5",
      channel: "release",
      proxy: "ghproxy-net",
      fetchOptions: { fetchImpl },
    });
    expect(up.available).toBe(true);
    if (!up.available) return;
    expect(seen[0]).toContain("https://ghproxy.net/https://api.github.com/");
    expect(up.assetUrl).toBe(
      "https://ghproxy.net/https://github.com/freeanima-org/freeanima/releases/download/v0.9.0/anima-linux-x64.tar.gz",
    );
  });
});

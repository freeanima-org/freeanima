import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { applyGithubReleaseProxy, normalizeGithubReleaseProxy } from "./github-release-proxy.ts";
import {
  clearGithubReleaseProxyPrefForTest,
  readGithubReleaseProxyPref,
  writeGithubReleaseProxyPref,
} from "./github-release-proxy-prefs.ts";
import { resolvePackagedUpdate } from "./app-update.ts";

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const prevStorage = globalThis.localStorage;

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage();
});

afterEach(() => {
  clearGithubReleaseProxyPrefForTest();
  globalThis.localStorage = prevStorage;
});

describe("portal-sdk github-release-proxy", () => {
  it("rewrites and normalizes", () => {
    expect(normalizeGithubReleaseProxy("x")).toBe("none");
    expect(
      applyGithubReleaseProxy("https://api.github.com/repos/a/b/releases/latest", "ghfast-top"),
    ).toBe("https://ghfast.top/https://api.github.com/repos/a/b/releases/latest");
  });

  it("persists prefs in localStorage", () => {
    writeGithubReleaseProxyPref("gh-proxy-com");
    expect(readGithubReleaseProxyPref()).toBe("gh-proxy-com");
    writeGithubReleaseProxyPref("none");
    expect(readGithubReleaseProxyPref()).toBe("none");
  });

  it("resolvePackagedUpdate rewrites asset via proxy", async () => {
    const release = {
      tag_name: "v0.9.0",
      prerelease: false,
      draft: false,
      html_url: "https://github.com/x/y/releases/tag/v0.9.0",
      assets: [
        {
          name: "freeanima-desktop-windows-x64-setup.exe",
          browser_download_url: "https://github.com/x/y/releases/download/v0.9.0/setup.exe",
        },
      ],
    };
    const seen: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      seen.push(String(url));
      return new Response(JSON.stringify(release), { status: 200 });
    }) as unknown as typeof fetch;
    const up = await resolvePackagedUpdate({
      kind: "desktop-windows",
      localVersion: "0.8.5",
      channel: "release",
      proxy: "gh-proxy-com",
      fetchImpl,
    });
    expect(up.available).toBe(true);
    if (!up.available) return;
    expect(seen[0]?.startsWith("https://gh-proxy.com/https://api.github.com/")).toBe(true);
    expect(up.assetUrl).toBe(
      "https://gh-proxy.com/https://github.com/x/y/releases/download/v0.9.0/setup.exe",
    );
  });
});

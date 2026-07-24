/// <reference lib="dom" />

import { normalizeGithubReleaseProxy, type GithubReleaseProxyId } from "./github-release-proxy.ts";

const STORAGE_KEY = "freeanima.github-release-proxy";

export function readGithubReleaseProxyPref(): GithubReleaseProxyId {
  try {
    if (typeof localStorage === "undefined") return "none";
    return normalizeGithubReleaseProxy(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "none";
  }
}

export function writeGithubReleaseProxyPref(id: GithubReleaseProxyId): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, normalizeGithubReleaseProxy(id));
  } catch {
    /* ignore */
  }
}

export function clearGithubReleaseProxyPrefForTest(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

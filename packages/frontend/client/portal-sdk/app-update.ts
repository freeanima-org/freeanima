/** 与 CI / @freeanima/core app-update 产物名与轨语义对齐（portal-sdk 不可依赖 core） */

import { isRecord } from "@freeanima/shared/util";

import type { BuildChannel } from "./build-meta.ts";
import { isSwitchableChannel } from "./build-meta.ts";
import {
  applyGithubReleaseProxy,
  normalizeGithubReleaseProxy,
  type GithubReleaseProxyId,
} from "./github-release-proxy.ts";

export type PackagedReleaseKind = "standalone-linux-x64" | "desktop-windows" | "mobile-android";

export const RELEASE_ASSET_NAMES: Record<PackagedReleaseKind, string> = {
  "standalone-linux-x64": "anima-linux-x64.tar.gz",
  "desktop-windows": "freeanima-desktop-windows-x64-setup.exe",
  "mobile-android": "freeanima-mobile-android.apk",
};

export const CANARY_RELEASE_TAG = "canary";
export const FREEANIMA_GITHUB_REPO = "freeanima-org/freeanima";

export type UpdateTrack = "release" | "canary";

export type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
};

export function normalizeSemver(raw: string): string {
  const s = raw.trim().replace(/^v/i, "");
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return "0.0.0";
  return `${m[1] ?? "0"}.${m[2] ?? "0"}.${m[3] ?? "0"}`;
}

export function compareSemver(a: string, b: string): number {
  const pa = normalizeSemver(a)
    .split(".")
    .map((x) => Number(x) || 0);
  const pb = normalizeSemver(b)
    .split(".")
    .map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function isSemverNewer(remote: string, local: string): boolean {
  return compareSemver(remote, local) > 0;
}

/** 提取 `+YYYYMMDDHHmm` build stamp；无则 undefined */
export function extractBuildStamp(raw: string): string | undefined {
  const m = raw
    .trim()
    .replace(/^v/i, "")
    .match(/\+(\d{12})\b/);
  return m?.[1];
}

/** 是否为可参与 canary 版本比较的具体版本串 */
export function isConcreteCanaryVersion(raw: string): boolean {
  const s = raw.trim().replace(/^v/i, "");
  if (!s || s === "canary") return false;
  return /^\d+\.\d+/.test(s);
}

/** 先主.次.修订，再比 `+YYYYMMDDHHmm`；无 stamp 视为更旧 */
export function compareCanaryVersion(a: string, b: string): number {
  const sem = compareSemver(a, b);
  if (sem !== 0) return sem;
  const sa = extractBuildStamp(a);
  const sb = extractBuildStamp(b);
  if (sa && sb) {
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }
  if (sa && !sb) return 1;
  if (!sa && sb) return -1;
  return 0;
}

export function isCanaryVersionNewer(remote: string, local: string): boolean {
  return compareCanaryVersion(remote, local) > 0;
}

export function matchReleaseAsset(
  kind: PackagedReleaseKind,
  assets: readonly GithubReleaseAsset[],
): GithubReleaseAsset | null {
  const want = RELEASE_ASSET_NAMES[kind];
  return assets.find((a) => a.name === want) ?? null;
}

export type PackagedUpdateResult =
  | {
      available: false;
      reason: "no_release" | "no_asset" | "up_to_date" | "unsupported_channel";
      remoteVersion?: string;
      remoteCommit?: string;
      track?: UpdateTrack;
    }
  | {
      available: true;
      remoteVersion: string;
      assetName: string;
      assetUrl: string;
      releaseUrl: string;
      assetSize?: number;
      remoteCommit?: string;
      track: UpdateTrack;
    };

type ReleaseJson = {
  tag_name?: string;
  prerelease?: boolean;
  draft?: boolean;
  html_url?: string;
  target_commitish?: string;
  body?: string;
  assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
};

function parseReleaseJson(raw: unknown): ReleaseJson | null {
  if (!isRecord(raw)) return null;
  const assetsRaw = raw.assets;
  const assets = Array.isArray(assetsRaw)
    ? assetsRaw.flatMap((item) => {
        if (!isRecord(item)) return [];
        return [
          {
            ...(typeof item.name === "string" ? { name: item.name } : {}),
            ...(typeof item.browser_download_url === "string"
              ? { browser_download_url: item.browser_download_url }
              : {}),
            ...(typeof item.size === "number" ? { size: item.size } : {}),
          },
        ];
      })
    : undefined;
  return {
    ...(typeof raw.tag_name === "string" ? { tag_name: raw.tag_name } : {}),
    ...(typeof raw.prerelease === "boolean" ? { prerelease: raw.prerelease } : {}),
    ...(typeof raw.draft === "boolean" ? { draft: raw.draft } : {}),
    ...(typeof raw.html_url === "string" ? { html_url: raw.html_url } : {}),
    ...(typeof raw.target_commitish === "string" ? { target_commitish: raw.target_commitish } : {}),
    ...(typeof raw.body === "string" ? { body: raw.body } : {}),
    ...(assets ? { assets } : {}),
  };
}

function githubHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "freeanima-shell-app-update",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function extractReleaseCommit(release: {
  target_commitish?: string;
  body?: string;
}): string | undefined {
  const tc = release.target_commitish?.trim();
  if (tc && /^[0-9a-f]{7,40}$/i.test(tc)) return tc.toLowerCase();
  const body = release.body ?? "";
  const m = body.match(/\bsha[:\s]+`?([0-9a-f]{7,40})`?/i);
  if (m?.[1]) return m[1].toLowerCase();
  return undefined;
}

/** 从 body 中的 `version: …` 提取完整版本串 */
export function extractReleaseVersion(release: { body?: string }): string | undefined {
  const body = release.body ?? "";
  const m = body.match(/\bversion:\s*`?([^\s`\n]+)`?/i);
  if (!m?.[1]) return undefined;
  const v = m[1].trim().replace(/^v/i, "");
  if (!v || v === "canary") return undefined;
  return v;
}

export function commitsMatch(local?: string, remote?: string): boolean {
  if (!local || !remote) return false;
  const a = local.trim().toLowerCase();
  const b = remote.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function assetsFromRelease(release: ReleaseJson): GithubReleaseAsset[] {
  const assets: GithubReleaseAsset[] = [];
  for (const a of release.assets ?? []) {
    if (typeof a.name === "string" && typeof a.browser_download_url === "string") {
      assets.push({
        name: a.name,
        browser_download_url: a.browser_download_url,
        ...(typeof a.size === "number" ? { size: a.size } : {}),
      });
    }
  }
  return assets;
}

async function fetchLatestStableRelease(
  fetchImpl: typeof fetch,
  proxy: GithubReleaseProxyId,
  signal?: AbortSignal,
): Promise<ReleaseJson | null> {
  const headers = githubHeaders();
  const latestRes = await fetchImpl(
    applyGithubReleaseProxy(
      `https://api.github.com/repos/${FREEANIMA_GITHUB_REPO}/releases/latest`,
      proxy,
    ),
    { headers, ...(signal ? { signal } : {}) },
  );
  if (latestRes.ok) {
    const j = parseReleaseJson(await latestRes.json());
    if (j && !j.draft && !j.prerelease) return j;
  }
  const listRes = await fetchImpl(
    applyGithubReleaseProxy(
      `https://api.github.com/repos/${FREEANIMA_GITHUB_REPO}/releases?per_page=10`,
      proxy,
    ),
    { headers, ...(signal ? { signal } : {}) },
  );
  if (!listRes.ok) return null;
  const listRaw: unknown = await listRes.json();
  if (!Array.isArray(listRaw)) return null;
  const list = listRaw.flatMap((item) => {
    const parsed = parseReleaseJson(item);
    return parsed ? [parsed] : [];
  });
  return list.find((r) => !r.draft && !r.prerelease) ?? null;
}

async function fetchReleaseByTag(
  tag: string,
  fetchImpl: typeof fetch,
  proxy: GithubReleaseProxyId,
  signal?: AbortSignal,
): Promise<ReleaseJson | null> {
  const encoded = encodeURIComponent(tag);
  const res = await fetchImpl(
    applyGithubReleaseProxy(
      `https://api.github.com/repos/${FREEANIMA_GITHUB_REPO}/releases/tags/${encoded}`,
      proxy,
    ),
    { headers: githubHeaders(), ...(signal ? { signal } : {}) },
  );
  if (!res.ok) return null;
  const j = parseReleaseJson(await res.json());
  if (!j || j.draft) return null;
  return j;
}

function isUpdateTrack(channel: BuildChannel): channel is UpdateTrack {
  return channel === "release" || channel === "canary";
}

export async function resolvePackagedUpdate(opts: {
  kind: PackagedReleaseKind;
  localVersion: string;
  channel: BuildChannel;
  localCommit?: string;
  intent?: "check" | "switch";
  targetChannel?: BuildChannel;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  proxy?: GithubReleaseProxyId;
}): Promise<PackagedUpdateResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const proxy = normalizeGithubReleaseProxy(opts.proxy);
  const intent = opts.intent ?? "check";
  const trackChannel = intent === "switch" ? (opts.targetChannel ?? opts.channel) : opts.channel;
  if (!isUpdateTrack(trackChannel)) {
    return { available: false, reason: "unsupported_channel" };
  }
  if (intent === "switch" && !isUpdateTrack(opts.channel)) {
    return { available: false, reason: "unsupported_channel" };
  }

  const release =
    trackChannel === "canary"
      ? await fetchReleaseByTag(CANARY_RELEASE_TAG, fetchImpl, proxy, opts.signal)
      : await fetchLatestStableRelease(fetchImpl, proxy, opts.signal);
  if (!release?.tag_name) {
    return { available: false, reason: "no_release", track: trackChannel };
  }

  const remoteCommit = extractReleaseCommit(release);
  const remoteVersion =
    trackChannel === "canary"
      ? (extractReleaseVersion(release) ?? release.tag_name)
      : release.tag_name;
  const assets = assetsFromRelease(release);
  const asset = matchReleaseAsset(opts.kind, assets);
  if (!asset) {
    return {
      available: false,
      reason: "no_asset",
      remoteVersion,
      track: trackChannel,
      ...(remoteCommit ? { remoteCommit } : {}),
    };
  }

  const available: Extract<PackagedUpdateResult, { available: true }> = {
    available: true,
    remoteVersion,
    assetName: asset.name,
    assetUrl: applyGithubReleaseProxy(asset.browser_download_url, proxy),
    releaseUrl: typeof release.html_url === "string" ? release.html_url : "",
    track: trackChannel,
    ...(asset.size != null ? { assetSize: asset.size } : {}),
    ...(remoteCommit ? { remoteCommit } : {}),
  };

  if (intent === "switch") return available;

  if (trackChannel === "release") {
    if (!isSemverNewer(available.remoteVersion, opts.localVersion)) {
      return {
        available: false,
        reason: "up_to_date",
        remoteVersion: available.remoteVersion,
        track: trackChannel,
        ...(remoteCommit ? { remoteCommit } : {}),
      };
    }
    return available;
  }

  // canary：优先比较完整版本串；无法解析时回退 commit
  if (
    isConcreteCanaryVersion(available.remoteVersion) &&
    isConcreteCanaryVersion(opts.localVersion)
  ) {
    if (!isCanaryVersionNewer(available.remoteVersion, opts.localVersion)) {
      return {
        available: false,
        reason: "up_to_date",
        remoteVersion: available.remoteVersion,
        track: trackChannel,
        ...(remoteCommit ? { remoteCommit } : {}),
      };
    }
    return available;
  }

  if (remoteCommit && commitsMatch(opts.localCommit, remoteCommit)) {
    return {
      available: false,
      reason: "up_to_date",
      remoteVersion: available.remoteVersion,
      remoteCommit,
      track: trackChannel,
    };
  }
  return available;
}

export function resolveNativePackagedKind(): PackagedReleaseKind | null {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  if (!shell) return null;
  // 能力优先：有 applyPackagedUpdate 则按壳类型选产物
  if (typeof shell.applyPackagedUpdate !== "function") return null;
  if (shell.isNativeShell && shell.primaryInput === "touch") return "mobile-android";
  if (shell.isTauri || shell.isNativeShell) return "desktop-windows";
  return "desktop-windows";
}

export function otherUpdateTrack(channel: UpdateTrack): UpdateTrack {
  return channel === "release" ? "canary" : "release";
}

export { isSwitchableChannel };

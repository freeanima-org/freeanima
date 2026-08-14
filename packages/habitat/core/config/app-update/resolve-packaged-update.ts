import type { BuildChannel } from "../build-meta.parse.ts";
import {
  applyGithubReleaseProxy,
  normalizeGithubReleaseProxy,
  type GithubReleaseProxyId,
} from "./github-release-proxy.ts";
import {
  CANARY_RELEASE_TAG,
  commitsMatch,
  extractReleaseCommit,
  extractReleaseVersion,
  fetchLatestRelease,
  fetchReleaseByTag,
  type FetchReleaseOptions,
  type GithubRelease,
} from "./github-releases.ts";
import { matchReleaseAsset, type PackagedReleaseKind } from "./release-assets.ts";
import { isCanaryVersionNewer, isConcreteCanaryVersion, isSemverNewer } from "./semver.ts";

/** 参与 GitHub 包更新的分发轨 */
export type UpdateTrack = "release" | "canary";

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

export function isUpdateTrack(channel: BuildChannel): channel is UpdateTrack {
  return channel === "release" || channel === "canary";
}

function resolveRemoteVersion(release: GithubRelease, track: UpdateTrack): string {
  if (track === "canary") {
    return extractReleaseVersion(release) ?? release.tag_name;
  }
  return release.tag_name;
}

function availableFromRelease(
  release: GithubRelease,
  kind: PackagedReleaseKind,
  track: UpdateTrack,
): PackagedUpdateResult {
  const remoteCommit = extractReleaseCommit(release);
  const remoteVersion = resolveRemoteVersion(release, track);
  const asset = matchReleaseAsset(kind, release.assets);
  if (!asset) {
    return {
      available: false,
      reason: "no_asset",
      remoteVersion,
      track,
      ...(remoteCommit ? { remoteCommit } : {}),
    };
  }
  return {
    available: true,
    remoteVersion,
    assetName: asset.name,
    assetUrl: asset.browser_download_url,
    releaseUrl: release.html_url,
    track,
    ...(asset.size != null ? { assetSize: asset.size } : {}),
    ...(remoteCommit ? { remoteCommit } : {}),
  };
}

async function fetchTrackRelease(
  track: UpdateTrack,
  fetchOptions: FetchReleaseOptions,
): Promise<GithubRelease | null> {
  if (track === "canary") {
    return fetchReleaseByTag(CANARY_RELEASE_TAG, fetchOptions);
  }
  return fetchLatestRelease({ ...fetchOptions, includePrerelease: false });
}

/**
 * 解析包装更新。
 * - intent=check（默认）：在 `channel` 轨内检查是否有更新
 * - intent=switch：取 `targetChannel` tip，有资产即 available（换轨安装）
 * - channel/target 为 local 或不合法 → unsupported_channel
 */
function withProxiedAssetUrl(
  result: PackagedUpdateResult,
  proxy: GithubReleaseProxyId,
): PackagedUpdateResult {
  if (!result.available) return result;
  return {
    ...result,
    assetUrl: applyGithubReleaseProxy(result.assetUrl, proxy),
  };
}

export async function resolvePackagedUpdate(opts: {
  kind: PackagedReleaseKind;
  localVersion: string;
  channel: BuildChannel;
  localCommit?: string;
  intent?: "check" | "switch";
  targetChannel?: BuildChannel;
  fetchOptions?: FetchReleaseOptions;
  /** 与 fetchOptions.proxy 等价；二者皆设时以本字段为准 */
  proxy?: GithubReleaseProxyId;
}): Promise<PackagedUpdateResult> {
  const intent = opts.intent ?? "check";
  const trackChannel = intent === "switch" ? (opts.targetChannel ?? opts.channel) : opts.channel;
  if (!isUpdateTrack(trackChannel)) {
    return { available: false, reason: "unsupported_channel" };
  }
  if (intent === "switch" && !isUpdateTrack(opts.channel)) {
    return { available: false, reason: "unsupported_channel" };
  }

  const proxy = normalizeGithubReleaseProxy(opts.proxy ?? opts.fetchOptions?.proxy);
  const fetchOptions: FetchReleaseOptions = {
    ...opts.fetchOptions,
    proxy,
  };

  const release = await fetchTrackRelease(trackChannel, fetchOptions);
  if (!release) return { available: false, reason: "no_release", track: trackChannel };

  const base = availableFromRelease(release, opts.kind, trackChannel);
  if (!base.available) return base;

  if (intent === "switch") {
    return withProxiedAssetUrl(base, proxy);
  }

  if (trackChannel === "release") {
    if (!isSemverNewer(base.remoteVersion, opts.localVersion)) {
      return {
        available: false,
        reason: "up_to_date",
        remoteVersion: base.remoteVersion,
        track: trackChannel,
        ...(base.remoteCommit ? { remoteCommit: base.remoteCommit } : {}),
      };
    }
    return withProxiedAssetUrl(base, proxy);
  }

  // canary：优先比较完整版本串；无法解析时回退 commit；皆不可比则仍提示有更新
  if (isConcreteCanaryVersion(base.remoteVersion) && isConcreteCanaryVersion(opts.localVersion)) {
    if (!isCanaryVersionNewer(base.remoteVersion, opts.localVersion)) {
      return {
        available: false,
        reason: "up_to_date",
        remoteVersion: base.remoteVersion,
        track: trackChannel,
        ...(base.remoteCommit ? { remoteCommit: base.remoteCommit } : {}),
      };
    }
    return withProxiedAssetUrl(base, proxy);
  }

  const remoteCommit = base.remoteCommit;
  if (remoteCommit && commitsMatch(opts.localCommit, remoteCommit)) {
    return {
      available: false,
      reason: "up_to_date",
      remoteVersion: base.remoteVersion,
      remoteCommit,
      track: trackChannel,
    };
  }
  return withProxiedAssetUrl(base, proxy);
}

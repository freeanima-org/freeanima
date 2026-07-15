import type { BuildChannel } from "../build-meta.parse.ts";
import {
  CANARY_RELEASE_TAG,
  commitsMatch,
  extractReleaseCommit,
  fetchLatestRelease,
  fetchReleaseByTag,
  type FetchReleaseOptions,
  type GithubRelease,
} from "./github-releases.ts";
import { matchReleaseAsset, type PackagedReleaseKind } from "./release-assets.ts";
import { isSemverNewer } from "./semver.ts";

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

function availableFromRelease(
  release: GithubRelease,
  kind: PackagedReleaseKind,
  track: UpdateTrack,
): PackagedUpdateResult {
  const remoteCommit = extractReleaseCommit(release);
  const asset = matchReleaseAsset(kind, release.assets);
  if (!asset) {
    return {
      available: false,
      reason: "no_asset",
      remoteVersion: release.tag_name,
      track,
      ...(remoteCommit ? { remoteCommit } : {}),
    };
  }
  return {
    available: true,
    remoteVersion: release.tag_name,
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
 * - channel/target 为 dev 或不合法 → unsupported_channel
 */
export async function resolvePackagedUpdate(opts: {
  kind: PackagedReleaseKind;
  localVersion: string;
  channel: BuildChannel;
  localCommit?: string;
  intent?: "check" | "switch";
  targetChannel?: BuildChannel;
  fetchOptions?: FetchReleaseOptions;
}): Promise<PackagedUpdateResult> {
  const intent = opts.intent ?? "check";
  const trackChannel = intent === "switch" ? (opts.targetChannel ?? opts.channel) : opts.channel;
  if (!isUpdateTrack(trackChannel)) {
    return { available: false, reason: "unsupported_channel" };
  }
  if (intent === "switch" && !isUpdateTrack(opts.channel)) {
    return { available: false, reason: "unsupported_channel" };
  }

  const release = await fetchTrackRelease(trackChannel, opts.fetchOptions ?? {});
  if (!release) return { available: false, reason: "no_release", track: trackChannel };

  const base = availableFromRelease(release, opts.kind, trackChannel);
  if (!base.available) return base;

  if (intent === "switch") {
    return base;
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
    return base;
  }

  // canary：commit 不同即有更新；无法解析远端 commit 时仍提示（避免永远 up_to_date）
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
  return base;
}

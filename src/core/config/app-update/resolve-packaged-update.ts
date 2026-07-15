import { fetchLatestRelease, type FetchLatestReleaseOptions } from "./github-releases.ts";
import { matchReleaseAsset, type PackagedReleaseKind } from "./release-assets.ts";
import { isSemverNewer } from "./semver.ts";

export type PackagedUpdateResult =
  | { available: false; reason: "no_release" | "no_asset" | "up_to_date"; remoteVersion?: string }
  | {
      available: true;
      remoteVersion: string;
      assetName: string;
      assetUrl: string;
      releaseUrl: string;
      assetSize?: number;
    };

export async function resolvePackagedUpdate(opts: {
  kind: PackagedReleaseKind;
  localVersion: string;
  fetchOptions?: FetchLatestReleaseOptions;
}): Promise<PackagedUpdateResult> {
  const release = await fetchLatestRelease(opts.fetchOptions ?? {});
  if (!release) return { available: false, reason: "no_release" };

  const remoteVersion = release.tag_name;
  const asset = matchReleaseAsset(opts.kind, release.assets);
  if (!asset) {
    return { available: false, reason: "no_asset", remoteVersion };
  }
  if (!isSemverNewer(remoteVersion, opts.localVersion)) {
    return { available: false, reason: "up_to_date", remoteVersion };
  }
  return {
    available: true,
    remoteVersion,
    assetName: asset.name,
    assetUrl: asset.browser_download_url,
    releaseUrl: release.html_url,
    ...(asset.size != null ? { assetSize: asset.size } : {}),
  };
}

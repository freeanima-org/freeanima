/** 与 CI / @freeanima/core app-update 产物名对齐（shell-sdk 不可依赖 core） */
export type PackagedReleaseKind = "standalone-linux-x64" | "desktop-windows" | "mobile-android";

export const RELEASE_ASSET_NAMES: Record<PackagedReleaseKind, string> = {
  "standalone-linux-x64": "anima-linux-x64.tar.gz",
  "desktop-windows": "freeanima-desktop-windows-x64-setup.exe",
  "mobile-android": "freeanima-mobile-android.apk",
};

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

export function matchReleaseAsset(
  kind: PackagedReleaseKind,
  assets: readonly GithubReleaseAsset[],
): GithubReleaseAsset | null {
  const want = RELEASE_ASSET_NAMES[kind];
  return assets.find((a) => a.name === want) ?? null;
}

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

type ReleaseJson = {
  tag_name?: string;
  prerelease?: boolean;
  draft?: boolean;
  html_url?: string;
  assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
};

async function fetchLatestTagRelease(
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ReleaseJson | null> {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "freeanima-shell-app-update",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const latestRes = await fetchImpl(
    "https://api.github.com/repos/freeanima-org/freeanima/releases/latest",
    { headers, ...(signal ? { signal } : {}) } as RequestInit,
  );
  if (latestRes.ok) {
    const j = (await latestRes.json()) as ReleaseJson;
    if (!j.draft && !j.prerelease) return j;
  }
  const listRes = await fetchImpl(
    "https://api.github.com/repos/freeanima-org/freeanima/releases?per_page=10",
    { headers, ...(signal ? { signal } : {}) } as RequestInit,
  );
  if (!listRes.ok) return null;
  const list = (await listRes.json()) as ReleaseJson[];
  if (!Array.isArray(list)) return null;
  return list.find((r) => !r.draft && !r.prerelease) ?? null;
}

export async function resolvePackagedUpdate(opts: {
  kind: PackagedReleaseKind;
  localVersion: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<PackagedUpdateResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const release = await fetchLatestTagRelease(fetchImpl, opts.signal);
  if (!release?.tag_name) return { available: false, reason: "no_release" };

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
  const asset = matchReleaseAsset(opts.kind, assets);
  if (!asset) {
    return { available: false, reason: "no_asset", remoteVersion: release.tag_name };
  }
  if (!isSemverNewer(release.tag_name, opts.localVersion)) {
    return { available: false, reason: "up_to_date", remoteVersion: release.tag_name };
  }
  return {
    available: true,
    remoteVersion: release.tag_name,
    assetName: asset.name,
    assetUrl: asset.browser_download_url,
    releaseUrl: typeof release.html_url === "string" ? release.html_url : "",
    ...(asset.size != null ? { assetSize: asset.size } : {}),
  };
}

export function resolveNativePackagedKind(): PackagedReleaseKind | null {
  const shell = typeof window !== "undefined" ? window.satelliteShell : undefined;
  if (shell?.isElectron) return "desktop-windows";
  if (shell?.isNativeShell) return "mobile-android";
  return null;
}

import type { GithubReleaseAsset } from "./release-assets.ts";

export const FREEANIMA_GITHUB_REPO = "freeanima-org/freeanima";

export type GithubRelease = {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  assets: GithubReleaseAsset[];
};

export type FetchLatestReleaseOptions = {
  repo?: string;
  /** 是否允许 prerelease（默认 false） */
  includePrerelease?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

function parseRelease(raw: unknown): GithubRelease | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.tag_name !== "string") return null;
  const assetsRaw = Array.isArray(o.assets) ? o.assets : [];
  const assets: GithubReleaseAsset[] = [];
  for (const a of assetsRaw) {
    if (a == null || typeof a !== "object") continue;
    const ar = a as Record<string, unknown>;
    if (typeof ar.name !== "string" || typeof ar.browser_download_url !== "string") continue;
    assets.push({
      name: ar.name,
      browser_download_url: ar.browser_download_url,
      ...(typeof ar.size === "number" ? { size: ar.size } : {}),
    });
  }
  return {
    tag_name: o.tag_name,
    prerelease: Boolean(o.prerelease),
    draft: Boolean(o.draft),
    html_url: typeof o.html_url === "string" ? o.html_url : "",
    assets,
  };
}

/** GET /repos/.../releases/latest；若为 draft/prerelease 不符则扫描列表 */
export async function fetchLatestRelease(
  options: FetchLatestReleaseOptions = {},
): Promise<GithubRelease | null> {
  const repo = options.repo ?? FREEANIMA_GITHUB_REPO;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "freeanima-app-update",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const latestRes = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
  } as RequestInit);
  if (latestRes.ok) {
    const release = parseRelease(await latestRes.json());
    if (release && !release.draft && (options.includePrerelease || !release.prerelease)) {
      return release;
    }
  }

  const listRes = await fetchImpl(`https://api.github.com/repos/${repo}/releases?per_page=10`, {
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
  } as RequestInit);
  if (!listRes.ok) return null;
  const list = (await listRes.json()) as unknown;
  if (!Array.isArray(list)) return null;
  for (const item of list) {
    const release = parseRelease(item);
    if (!release || release.draft) continue;
    if (!options.includePrerelease && release.prerelease) continue;
    return release;
  }
  return null;
}

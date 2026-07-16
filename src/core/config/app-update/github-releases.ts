import {
  applyGithubReleaseProxy,
  normalizeGithubReleaseProxy,
  type GithubReleaseProxyId,
} from "./github-release-proxy.ts";
import type { GithubReleaseAsset } from "./release-assets.ts";

export const FREEANIMA_GITHUB_REPO = "freeanima-org/freeanima";
export const CANARY_RELEASE_TAG = "canary";

export type GithubRelease = {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  assets: GithubReleaseAsset[];
  target_commitish?: string;
  body?: string;
};

export type FetchReleaseOptions = {
  repo?: string;
  /** 是否允许 prerelease（默认 false）；仅对 latest/list 扫描生效 */
  includePrerelease?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** 公共 gh-proxy；默认直连 */
  proxy?: GithubReleaseProxyId;
};

function resolveProxy(options: FetchReleaseOptions): GithubReleaseProxyId {
  return normalizeGithubReleaseProxy(options.proxy);
}

function proxiedGithubApiUrl(path: string, proxy: GithubReleaseProxyId): string {
  return applyGithubReleaseProxy(`https://api.github.com${path}`, proxy);
}

function githubHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "freeanima-app-update",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function parseGithubRelease(raw: unknown): GithubRelease | null {
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
    ...(typeof o.target_commitish === "string" && o.target_commitish.trim()
      ? { target_commitish: o.target_commitish.trim() }
      : {}),
    ...(typeof o.body === "string" ? { body: o.body } : {}),
  };
}

/** 从 target_commitish（完整/短 SHA）或 body 中的 `sha: …` 提取 commit */
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

/** 本地与远端 commit 是否视为同一 tip（短/长 SHA 前缀匹配） */
export function commitsMatch(local?: string, remote?: string): boolean {
  if (!local || !remote) return false;
  const a = local.trim().toLowerCase();
  const b = remote.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/** GET /repos/.../releases/latest；若为 draft/prerelease 不符则扫描列表 */
export async function fetchLatestRelease(
  options: FetchReleaseOptions = {},
): Promise<GithubRelease | null> {
  const repo = options.repo ?? FREEANIMA_GITHUB_REPO;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = githubHeaders();
  const proxy = resolveProxy(options);

  const latestRes = await fetchImpl(proxiedGithubApiUrl(`/repos/${repo}/releases/latest`, proxy), {
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
  } as RequestInit);
  if (latestRes.ok) {
    const release = parseGithubRelease(await latestRes.json());
    if (release && !release.draft && (options.includePrerelease || !release.prerelease)) {
      return release;
    }
  }

  const listRes = await fetchImpl(
    proxiedGithubApiUrl(`/repos/${repo}/releases?per_page=10`, proxy),
    {
      headers,
      ...(options.signal ? { signal: options.signal } : {}),
    } as RequestInit,
  );
  if (!listRes.ok) return null;
  const list = (await listRes.json()) as unknown;
  if (!Array.isArray(list)) return null;
  for (const item of list) {
    const release = parseGithubRelease(item);
    if (!release || release.draft) continue;
    if (!options.includePrerelease && release.prerelease) continue;
    return release;
  }
  return null;
}

/** GET /repos/.../releases/tags/{tag} */
export async function fetchReleaseByTag(
  tag: string,
  options: FetchReleaseOptions = {},
): Promise<GithubRelease | null> {
  const repo = options.repo ?? FREEANIMA_GITHUB_REPO;
  const fetchImpl = options.fetchImpl ?? fetch;
  const encoded = encodeURIComponent(tag);
  const proxy = resolveProxy(options);
  const res = await fetchImpl(
    proxiedGithubApiUrl(`/repos/${repo}/releases/tags/${encoded}`, proxy),
    {
      headers: githubHeaders(),
      ...(options.signal ? { signal: options.signal } : {}),
    } as RequestInit,
  );
  if (!res.ok) return null;
  const release = parseGithubRelease(await res.json());
  if (!release || release.draft) return null;
  return release;
}

export type FetchLatestReleaseOptions = FetchReleaseOptions;

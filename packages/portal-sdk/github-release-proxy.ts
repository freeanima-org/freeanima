/** GitHub Release 公共反代（与 core / install.sh 同 id 表；portal-sdk 不可依赖 core） */

export const GITHUB_RELEASE_PROXY_IDS = [
  "none",
  "ghproxy-net",
  "gh-proxy-com",
  "ghfast-top",
] as const;

export type GithubReleaseProxyId = (typeof GITHUB_RELEASE_PROXY_IDS)[number];

/** 各代理 URL 前缀（末尾含 `/`）；`none` 不改写 */
export const GITHUB_RELEASE_PROXY_PREFIX: Record<Exclude<GithubReleaseProxyId, "none">, string> = {
  "ghproxy-net": "https://ghproxy.net/",
  "gh-proxy-com": "https://gh-proxy.com/",
  "ghfast-top": "https://ghfast.top/",
};

export function isGithubReleaseProxyId(raw: unknown): raw is GithubReleaseProxyId {
  return typeof raw === "string" && (GITHUB_RELEASE_PROXY_IDS as readonly string[]).includes(raw);
}

/** 非法 / 空 → `none` */
export function normalizeGithubReleaseProxy(raw: unknown): GithubReleaseProxyId {
  if (isGithubReleaseProxyId(raw)) return raw;
  return "none";
}

/**
 * 将 GitHub API / Release 下载 URL 套上公共反代前缀。
 * 已带同一前缀则幂等；`none` 原样返回。
 */
export function applyGithubReleaseProxy(url: string, proxy: GithubReleaseProxyId = "none"): string {
  const id = normalizeGithubReleaseProxy(proxy);
  if (id === "none") return url;
  const prefix = GITHUB_RELEASE_PROXY_PREFIX[id];
  if (url.startsWith(prefix)) return url;
  return `${prefix}${url}`;
}

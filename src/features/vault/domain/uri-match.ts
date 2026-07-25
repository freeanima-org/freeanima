/** Bitwarden 式 URI 匹配（客户端；无服务端 match API）。 */

export type VaultUriMatchKind = "domain" | "host" | "starts_with" | "exact" | "regex" | "never";

export type VaultUriEntry = {
  uri: string;
  match?: VaultUriMatchKind | undefined;
};

export type VaultUriMatchable = {
  id: number;
  url?: string | undefined;
  uris?: VaultUriEntry[] | undefined;
};

export type VaultUriMatchResult = {
  id: number;
  score: number;
  matched_uri: string;
  match: VaultUriMatchKind;
};

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** 解析 URL；失败时尝试补 https:// */
export function parsePageUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function baseDomain(host: string): string {
  const h = stripWww(host.toLowerCase());
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  // 简化 eTLD+1：取末两段（足够覆盖常见 autofill；不引入 PSL）
  return parts.slice(-2).join(".");
}

function entryList(item: VaultUriMatchable): Array<{ uri: string; match: VaultUriMatchKind }> {
  if (item.uris && item.uris.length > 0) {
    return item.uris
      .map((e) => ({
        uri: e.uri.trim(),
        match: e.match ?? ("domain" as const),
      }))
      .filter((e) => e.uri.length > 0);
  }
  if (item.url?.trim()) {
    return [{ uri: item.url.trim(), match: "domain" }];
  }
  return [];
}

/** 单条 URI 是否匹配当前页；返回分数（越大越好），不匹配为 0 */
export function scoreUriMatch(
  pageUrl: string,
  entryUri: string,
  match: VaultUriMatchKind = "domain",
): number {
  if (match === "never") return 0;
  const page = parsePageUrl(pageUrl);
  if (!page) return 0;

  if (match === "exact") {
    const target = parsePageUrl(entryUri);
    if (!target) return pageUrl === entryUri ? 100 : 0;
    return page.href === target.href ? 100 : 0;
  }

  if (match === "starts_with") {
    const prefix = entryUri.trim();
    if (!prefix) return 0;
    return page.href.startsWith(prefix) || pageUrl.startsWith(prefix) ? 80 : 0;
  }

  if (match === "regex") {
    try {
      const re = new RegExp(entryUri);
      return re.test(page.href) || re.test(pageUrl) ? 70 : 0;
    } catch {
      return 0;
    }
  }

  const target = parsePageUrl(entryUri);
  if (!target) return 0;
  const pageHost = stripWww(page.hostname.toLowerCase());
  const targetHost = stripWww(target.hostname.toLowerCase());

  if (match === "host") {
    return pageHost === targetHost ? 90 : 0;
  }

  // domain（默认）
  const pageBase = baseDomain(pageHost);
  const targetBase = baseDomain(targetHost);
  if (pageBase !== targetBase) return 0;
  if (pageHost === targetHost) return 85;
  // 子域匹配同注册域
  if (pageHost.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${pageHost}`)) return 75;
  return 60;
}

/** 对条目列表按当前页 URL 匹配并排序（高分在前） */
export function matchVaultItemsForUrl(
  pageUrl: string,
  items: VaultUriMatchable[],
): VaultUriMatchResult[] {
  const out: VaultUriMatchResult[] = [];
  for (const item of items) {
    let best: VaultUriMatchResult | null = null;
    for (const entry of entryList(item)) {
      const score = scoreUriMatch(pageUrl, entry.uri, entry.match);
      if (score <= 0) continue;
      if (!best || score > best.score) {
        best = {
          id: item.id,
          score,
          matched_uri: entry.uri,
          match: entry.match,
        };
      }
    }
    if (best) out.push(best);
  }
  return out.toSorted((a, b) => b.score - a.score || a.id - b.id);
}

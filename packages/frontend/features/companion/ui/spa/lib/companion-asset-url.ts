export type CompanionAssetRef = { kind: "models" | "motions"; fileName: string };

/** 对路径各段做 URL 编码（保留 `/`） */
export function encodeCompanionAssetPath(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const q = path.indexOf("?");
  const pathname = q >= 0 ? path.slice(0, q) : path;
  const query = q >= 0 ? path.slice(q) : "";
  const encoded = pathname
    .split("/")
    .map((segment, index) =>
      index === 0 || segment === "" ? segment : encodeURIComponent(segment),
    )
    .join("/");
  return encoded + query;
}

/** 解析 `/models|motions/<file>` 相对路径；绝对 URL 或其它路径返回 null */
export function parseCompanionAssetPath(path: string): CompanionAssetRef | null {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const m = normalized.match(/^\/(models|motions)\/(.+)$/);
  if (!m) return null;
  const kind = m[1] as "models" | "motions";
  const fileName = decodeURIComponent(m[2] ?? "");
  if (!fileName) return null;
  return { kind, fileName };
}

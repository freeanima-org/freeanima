import { habitatRpcRestPrefix } from "@freeanima/shared/habitat-rpc";
import { resolveHubBaseUrl } from "./companion-local.ts";

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

/**
 * 将 companion 相对资产路径解析为 Habitat REST URL（`companion.asset.get`）。
 * 绝对 http(s) URL 原样返回。
 * 运行时拉取请优先用 model-cache 的 callRaw，勿手拼 Bearer。
 */
export async function resolveCompanionAssetUrl(path: string): Promise<string> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const parsed = parseCompanionAssetPath(path);
  if (!parsed) {
    if (path.startsWith("/")) {
      const base = await resolveHubBaseUrl();
      return `${base}${encodeCompanionAssetPath(path)}`;
    }
    return path;
  }
  const base = (await resolveHubBaseUrl()).replace(/\/$/, "");
  return `${base}${habitatRpcRestPrefix()}/companion/assets/${parsed.kind}/${encodeURIComponent(parsed.fileName)}`;
}

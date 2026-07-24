import { habitatRpcRestPrefix } from "@freeanima/shared/habitat-rpc";
import { resolveHubBaseUrl } from "./sidecar.ts";

/** 对路径各段做 URL 编码（保留 `/`） */
export function encodeSidecarPath(path: string): string {
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

function parseCompanionAssetPath(
  path: string,
): { kind: "models" | "motions"; fileName: string } | null {
  const m = path.match(/^\/(models|motions)\/(.+)$/);
  if (!m) return null;
  const kind = m[1] as "models" | "motions";
  const fileName = decodeURIComponent(m[2] ?? "");
  if (!fileName) return null;
  return { kind, fileName };
}

function resolveAuthToken(): string | undefined {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  const token = shell?.remoteAuth?.token?.trim();
  return token || undefined;
}

/**
 * 将 companion 相对资产路径解析为 Habitat REST URL（`companion.asset.get`）。
 * 绝对 http(s) URL 原样返回。
 */
export async function resolveCompanionAssetUrl(path: string): Promise<string> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const parsed = parseCompanionAssetPath(path.startsWith("/") ? path : `/${path}`);
  if (!parsed) {
    // 非 /models|/motions 前缀：尽量按旧行为拼 habitat 根（极少见）
    if (path.startsWith("/")) {
      const base = await resolveHubBaseUrl();
      return `${base}${encodeSidecarPath(path)}`;
    }
    return path;
  }
  const base = (await resolveHubBaseUrl()).replace(/\/$/, "");
  return `${base}${habitatRpcRestPrefix()}/companion/assets/${parsed.kind}/${encodeURIComponent(parsed.fileName)}`;
}

/** @deprecated 使用 resolveCompanionAssetUrl */
export async function resolveSidecarAssetUrl(path: string): Promise<string> {
  return resolveCompanionAssetUrl(path);
}

/** 拉取 companion 资产时附带的 Authorization（若有） */
export function companionAssetFetchHeaders(): HeadersInit | undefined {
  const token = resolveAuthToken();
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

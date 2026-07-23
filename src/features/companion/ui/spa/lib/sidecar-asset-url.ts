import { resolveSidecarOrigin } from "./sidecar.ts";

/** 对 sidecar 路径各段做 URL 编码（保留 `/`，空格等字符可正确请求） */
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

export async function resolveSidecarAssetUrl(path: string): Promise<string> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("/")) {
    const base = await resolveSidecarOrigin();
    return `${base}${encodeSidecarPath(path)}`;
  }
  return path;
}

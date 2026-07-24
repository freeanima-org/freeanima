import { getCompanionHabitatClient } from "./habitat-client.ts";
import { parseCompanionAssetPath } from "./companion-asset-url.ts";

const CACHE_NAME = "companion-vrm-v1";

export type CachedModelSource = {
  url: string;
  fromCache: boolean;
  revoke: () => void;
};

async function blobUrlFromResponse(res: Response): Promise<CachedModelSource> {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return {
    url,
    fromCache: false,
    revoke: () => URL.revokeObjectURL(url),
  };
}

/** 经统一 Habitat client 拉取 companion 资产（相对路径 → callRaw；绝对 URL → fetch） */
async function fetchCompanionAssetResponse(pathOrUrl: string): Promise<Response> {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return fetch(pathOrUrl);
  }
  const parsed = parseCompanionAssetPath(pathOrUrl);
  if (!parsed) {
    throw new Error(`不支持的 companion 资产路径: ${pathOrUrl}`);
  }
  return getCompanionHabitatClient().callRaw("companion.asset.get", {
    kind: parsed.kind,
    fileName: parsed.fileName,
  });
}

function cacheKeyFor(pathOrUrl: string): string {
  const parsed = parseCompanionAssetPath(pathOrUrl);
  if (parsed) return `companion-asset:${parsed.kind}/${parsed.fileName}`;
  return pathOrUrl;
}

/** 拉取 Habitat companion 资产并返回 blob URL，供 GLTFLoader 使用。 */
export async function loadCompanionAssetBlobUrl(pathOrUrl: string): Promise<CachedModelSource> {
  const res = await fetchCompanionAssetResponse(pathOrUrl);
  if (!res.ok) {
    throw new Error(`资产下载失败 (HTTP ${res.status})`);
  }
  return blobUrlFromResponse(res);
}

/** 从网络或 Cache API 加载 VRM/VRMA，返回 blob URL 供 GLTFLoader 使用 */
export async function loadCachedModelSource(pathOrUrl: string): Promise<CachedModelSource> {
  if (typeof caches === "undefined") {
    return loadCompanionAssetBlobUrl(pathOrUrl);
  }

  const cache = await caches.open(CACHE_NAME);
  const cacheKey = cacheKeyFor(pathOrUrl);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const blob = await cached.blob();
    const url = URL.createObjectURL(blob);
    return {
      url,
      fromCache: true,
      revoke: () => URL.revokeObjectURL(url),
    };
  }

  const res = await fetchCompanionAssetResponse(pathOrUrl);
  if (!res.ok) {
    throw new Error(`模型下载失败 (HTTP ${res.status})`);
  }

  await cache.put(cacheKey, res.clone());
  return blobUrlFromResponse(res);
}

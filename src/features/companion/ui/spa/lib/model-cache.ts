import { companionAssetFetchHeaders } from "./sidecar-asset-url.ts";

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

async function fetchCompanionAsset(url: string): Promise<Response> {
  const headers = companionAssetFetchHeaders();
  return fetch(url, headers ? { headers } : undefined);
}

/** 拉取 Habitat companion 资产（带 auth）并返回 blob URL，供 GLTFLoader 使用。 */
export async function loadCompanionAssetBlobUrl(assetUrl: string): Promise<CachedModelSource> {
  const res = await fetchCompanionAsset(assetUrl);
  if (!res.ok) {
    throw new Error(`资产下载失败 (HTTP ${res.status})`);
  }
  return blobUrlFromResponse(res);
}

/** 从网络或 Cache API 加载 VRM，返回 blob URL 供 GLTFLoader 使用 */
export async function loadCachedModelSource(modelUrl: string): Promise<CachedModelSource> {
  if (typeof caches === "undefined") {
    return loadCompanionAssetBlobUrl(modelUrl);
  }

  const cache = await caches.open(CACHE_NAME);
  const cacheKey = modelUrl;
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

  const res = await fetchCompanionAsset(modelUrl);
  if (!res.ok) {
    throw new Error(`模型下载失败 (HTTP ${res.status})`);
  }

  await cache.put(cacheKey, res.clone());
  return blobUrlFromResponse(res);
}

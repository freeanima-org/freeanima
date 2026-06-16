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

/** 从网络或 Cache API 加载 VRM，返回 blob URL 供 GLTFLoader 使用 */
export async function loadCachedModelSource(modelUrl: string): Promise<CachedModelSource> {
  if (typeof caches === "undefined") {
    const res = await fetch(modelUrl);
    if (!res.ok) {
      throw new Error(`模型下载失败 (HTTP ${res.status})`);
    }
    return blobUrlFromResponse(res);
  }

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(modelUrl);
  if (cached) {
    const blob = await cached.blob();
    const url = URL.createObjectURL(blob);
    return {
      url,
      fromCache: true,
      revoke: () => URL.revokeObjectURL(url),
    };
  }

  const res = await fetch(modelUrl);
  if (!res.ok) {
    throw new Error(`模型下载失败 (HTTP ${res.status})`);
  }

  await cache.put(modelUrl, res.clone());
  return blobUrlFromResponse(res);
}

import { getCompanionHabitatClient } from "./habitat-client.ts";
import { parseCompanionAssetPath } from "./companion-asset-url.ts";
import { useCompanionStore } from "../stores/companion.ts";

const CACHE_NAME = "companion-object-v1";
const CACHE_ORIGIN = "https://companion-asset.invalid";

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

/** 缓存路径 `{id}.vrm` / `{id}.vrma` → object_file_id */
function lookupObjectFileId(pathOrUrl: string): number | undefined {
  const parsed = parseCompanionAssetPath(pathOrUrl);
  if (!parsed) return undefined;
  const stem = parsed.fileName.replace(/\.(vrm|vrma)$/i, "");
  const asNum = Number(stem);
  if (Number.isInteger(asNum) && asNum > 0) {
    const state = useCompanionStore.getState();
    if (parsed.kind === "models") {
      if (state.models.some((m) => m.object_file_id === asNum)) return asNum;
    } else if (state.motionLibrary.some((m) => m.object_file_id === asNum)) {
      return asNum;
    }
    return asNum;
  }
  return undefined;
}

async function fetchCompanionAssetResponse(pathOrUrl: string): Promise<Response> {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return fetch(pathOrUrl);
  }
  const fileId = lookupObjectFileId(pathOrUrl);
  if (fileId == null) {
    throw new Error(`无法解析 companion 资产 object_file_id: ${pathOrUrl}`);
  }
  return getCompanionHabitatClient().callRaw("object_storage.file.get", { id: fileId });
}

export function cacheKeyFor(pathOrUrl: string, objectFileId?: number): string {
  const id = objectFileId ?? lookupObjectFileId(pathOrUrl);
  if (id != null && id > 0) {
    return `${CACHE_ORIGIN}/file/${id}`;
  }
  return pathOrUrl;
}

export async function loadCompanionAssetBlobUrl(pathOrUrl: string): Promise<CachedModelSource> {
  const res = await fetchCompanionAssetResponse(pathOrUrl);
  if (!res.ok) {
    throw new Error(`资产下载失败 (HTTP ${res.status})`);
  }
  return blobUrlFromResponse(res);
}

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

  try {
    await cache.put(cacheKey, res.clone());
  } catch {
    // 写入失败不阻断加载
  }
  return blobUrlFromResponse(res);
}

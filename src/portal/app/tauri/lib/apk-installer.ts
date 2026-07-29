import { addPluginListener, invoke, type PluginListener } from "@tauri-apps/api/core";

export type ApkDownloadProgress = {
  received: number;
  total: number | null;
  phase?: "downloading" | "installing";
};

type ApkProgressEvent = {
  received?: number;
  total?: number;
  phase?: "downloading" | "installing";
};

/** 合并插件上报 total 与 GitHub assetSize（CDN 常无 Content-Length） */
export function resolveApkProgressTotal(
  reported: number | null | undefined,
  expectedSize: number | undefined,
): number | null {
  if (typeof reported === "number" && Number.isFinite(reported) && reported > 0) {
    return reported;
  }
  if (typeof expectedSize === "number" && Number.isFinite(expectedSize) && expectedSize > 0) {
    return expectedSize;
  }
  return null;
}

/** Tauri Android：下载 APK 并以系统安装器覆盖安装。 */
export async function installApkFromUrl(
  url: string,
  opts?: {
    onProgress?: (progress: ApkDownloadProgress) => void;
    /** Release asset size；Content-Length 缺失时用于百分比 */
    expectedSize?: number;
  },
): Promise<void> {
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new Error("无效的安装包 URL");
  }
  const onProgress = opts?.onProgress;
  const expectedSize = opts?.expectedSize;
  let handle: PluginListener | undefined;
  if (onProgress) {
    handle = await addPluginListener("apk-installer", "downloadProgress", (event: unknown) => {
      const raw = (event ?? {}) as ApkProgressEvent;
      const received = typeof raw.received === "number" ? raw.received : 0;
      const reported =
        typeof raw.total === "number" && Number.isFinite(raw.total) ? raw.total : null;
      onProgress({
        received,
        total: resolveApkProgressTotal(reported, expectedSize),
        ...(raw.phase != null ? { phase: raw.phase } : {}),
      });
    });
  }
  try {
    await invoke("plugin:apk-installer|installFromUrl", { url });
  } finally {
    await handle?.unregister();
  }
}

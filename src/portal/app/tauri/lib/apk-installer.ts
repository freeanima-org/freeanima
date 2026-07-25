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

/** Tauri Android：下载 APK 并以系统安装器覆盖安装。 */
export async function installApkFromUrl(
  url: string,
  opts?: { onProgress?: (progress: ApkDownloadProgress) => void },
): Promise<void> {
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new Error("无效的安装包 URL");
  }
  const onProgress = opts?.onProgress;
  let handle: PluginListener | undefined;
  if (onProgress) {
    handle = await addPluginListener("apk-installer", "downloadProgress", (event: unknown) => {
      const raw = (event ?? {}) as ApkProgressEvent;
      const received = typeof raw.received === "number" ? raw.received : 0;
      const total = typeof raw.total === "number" && Number.isFinite(raw.total) ? raw.total : null;
      onProgress({
        received,
        total,
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

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type ApkDownloadProgressEvent = {
  received: number;
  total?: number;
  phase?: "downloading" | "installing";
};

type ApkInstallerPlugin = {
  installFromUrl(options: { url: string }): Promise<{ ok: boolean }>;
  addListener(
    eventName: "downloadProgress",
    listenerFunc: (event: ApkDownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
};

const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

export type ApkDownloadProgress = {
  received: number;
  total: number | null;
  phase?: "downloading" | "installing";
};

/** Capacitor 进度事件 → Shell 统一进度形状 */
export function mapApkDownloadProgressEvent(event: ApkDownloadProgressEvent): ApkDownloadProgress {
  return {
    received: event.received,
    total: event.total != null && Number.isFinite(event.total) ? event.total : null,
    ...(event.phase != null ? { phase: event.phase } : {}),
  };
}

export async function installApkFromUrl(
  url: string,
  opts?: { onProgress?: (progress: ApkDownloadProgress) => void },
): Promise<void> {
  const onProgress = opts?.onProgress;
  let handle: PluginListenerHandle | undefined;
  if (onProgress) {
    handle = await ApkInstaller.addListener("downloadProgress", (event) => {
      onProgress(mapApkDownloadProgressEvent(event));
    });
  }
  try {
    await ApkInstaller.installFromUrl({ url });
  } finally {
    await handle?.remove();
  }
}

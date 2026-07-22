export type ApkDownloadProgress = {
  received: number;
  total: number | null;
  phase?: "downloading" | "installing";
};

/** Tauri Android 覆盖安装（待 Rust 侧实现）。 */
export async function installApkFromUrl(
  _url: string,
  _opts?: { onProgress?: (progress: ApkDownloadProgress) => void },
): Promise<void> {
  throw new Error("Tauri Android 覆盖安装尚未实现");
}

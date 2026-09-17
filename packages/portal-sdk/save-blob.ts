import type { ShellSaveBlobResult } from "./shell-api.ts";

export type SaveOrDownloadResult = {
  native: boolean;
  cancelled: boolean;
  path?: string;
};

const WEB_REVOKE_DELAY_MS = 2000;

function runtimeWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

/** 原生壳是否注入了 `saveBlob`（WebView 的 `<a download>` 不可用） */
export function hasNativeBlobSave(): boolean {
  return typeof runtimeWindow()?.portalShell?.saveBlob === "function";
}

export function triggerWebBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.trim() || `download-${Date.now()}`;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), WEB_REVOKE_DELAY_MS);
}

/**
 * 有 `portalShell.saveBlob` 时走原生落盘；否则浏览器 `<a download>`。
 * 用户取消另存对话框时 `cancelled: true`，不抛错。
 */
export async function saveOrDownloadBlob(
  blob: Blob,
  filename: string,
): Promise<SaveOrDownloadResult> {
  const name = filename.trim() || `download-${Date.now()}`;
  const save = runtimeWindow()?.portalShell?.saveBlob;
  if (typeof save === "function") {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mimeType = blob.type.trim();
    const result: ShellSaveBlobResult = await save({
      filename: name,
      bytes,
      ...(mimeType ? { mimeType } : {}),
    });
    return {
      native: true,
      cancelled: Boolean(result?.cancelled),
      ...(result?.path ? { path: result.path } : {}),
    };
  }
  triggerWebBlobDownload(blob, name);
  return { native: false, cancelled: false };
}

import { invoke } from "@tauri-apps/api/core";
import type {
  ShellSaveBlobOpts,
  ShellSaveBlobResult,
} from "@freeanima/client/portal-sdk/shell-api.ts";

const B64_CHUNK = 0x8000;

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    const slice = bytes.subarray(i, i + B64_CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/** Tauri Android：写入系统下载目录 */
export async function saveBlobToAndroidDownloads(
  opts: ShellSaveBlobOpts,
): Promise<ShellSaveBlobResult> {
  return invoke<ShellSaveBlobResult>("plugin:blob-saver|saveToDownloads", {
    filename: opts.filename,
    mimeType: opts.mimeType ?? "application/octet-stream",
    contentsBase64: uint8ToBase64(opts.bytes),
  });
}

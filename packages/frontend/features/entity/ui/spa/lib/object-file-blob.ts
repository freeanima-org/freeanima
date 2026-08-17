import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

export type ObjectFileMediaKind = "image" | "audio" | "video" | "other";

export function objectFileMediaKind(mimeType: string | undefined | null): ObjectFileMediaKind {
  const mime = (mimeType ?? "").trim().toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

export async function fetchObjectFileBlob(id: number): Promise<Blob> {
  const res = await getTypedHabitatClient().callRaw("object_storage.file.get", { id });
  if (!res.ok) {
    throw new Error(`下载失败（HTTP ${res.status}）`);
  }
  return res.blob();
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.trim() || `object_file-${Date.now()}`;
    a.rel = "noopener";
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

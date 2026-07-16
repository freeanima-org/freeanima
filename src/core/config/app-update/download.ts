import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export async function downloadReleaseAsset(
  url: string,
  destPath: string,
  opts?: { signal?: AbortSignal; expectedSize?: number; fetchImpl?: typeof fetch },
): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    ...(opts?.signal ? { signal: opts.signal } : {}),
    headers: { "User-Agent": "freeanima-app-update", Accept: "application/octet-stream" },
    redirect: "follow",
  } as RequestInit);
  if (!res.ok) {
    throw new Error(`下载失败 HTTP ${res.status}: ${url}`);
  }
  if (opts?.expectedSize != null) {
    const len = res.headers.get("content-length");
    if (len != null && Number(len) !== opts.expectedSize) {
      throw new Error(`下载大小不符: expect ${opts.expectedSize}, got ${len}`);
    }
  }
  if (!res.body) throw new Error("下载响应无 body");
  const nodeStream = Readable.fromWeb(
    res.body as unknown as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(destPath));
}

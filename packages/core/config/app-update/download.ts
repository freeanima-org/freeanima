import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";

export type DownloadProgress = {
  received: number;
  total: number | null;
};

export type DownloadProgressHandler = (progress: DownloadProgress) => void;

const DEFAULT_PROGRESS_INTERVAL_MS = 100;

/** 将响应 body 写入文件，可选节流进度回调 */
export async function pipeResponseBodyToFile(
  body: ReadableStream<Uint8Array> | Readable,
  destPath: string,
  opts?: {
    total?: number | null;
    onProgress?: DownloadProgressHandler;
    progressIntervalMs?: number;
  },
): Promise<void> {
  const total = opts?.total ?? null;
  const onProgress = opts?.onProgress;
  const intervalMs = opts?.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS;

  const nodeStream =
    body instanceof Readable
      ? body
      : // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Fetch body → Node ReadableStream
        Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream);

  if (!onProgress) {
    await pipeline(nodeStream, createWriteStream(destPath));
    return;
  }

  let received = 0;
  let lastReportAt = 0;
  const report = (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastReportAt < intervalMs) return;
    lastReportAt = now;
    onProgress({ received, total });
  };

  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      report(false);
      cb(null, chunk);
    },
    flush(cb) {
      report(true);
      cb();
    },
  });

  await pipeline(nodeStream, counter, createWriteStream(destPath));
}

export async function downloadReleaseAsset(
  url: string,
  destPath: string,
  opts?: {
    signal?: AbortSignal;
    expectedSize?: number;
    fetchImpl?: typeof fetch;
    onProgress?: DownloadProgressHandler;
  },
): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    ...(opts?.signal ? { signal: opts.signal } : {}),
    headers: { "User-Agent": "freeanima-app-update", Accept: "application/octet-stream" },
    redirect: "follow",
  });
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

  const contentLength = res.headers.get("content-length");
  const total = opts?.expectedSize ?? (contentLength != null ? Number(contentLength) : null);
  const resolvedTotal = total != null && Number.isFinite(total) && total >= 0 ? total : null;

  await pipeResponseBodyToFile(res.body, destPath, {
    total: resolvedTotal,
    ...(opts?.onProgress ? { onProgress: opts.onProgress } : {}),
  });
}

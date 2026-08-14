/** 二进制响应：ETag = cid，协商缓存（304 可不拉字节） */

export const OBJECT_FILE_CACHE_CONTROL = "private, no-cache";

export function etagForCid(cid: string): string {
  return `"${cid}"`;
}

/** If-None-Match 命中则 304，调用方应在拉 S3/磁盘之前调用 */
export function notModifiedIfMatch(req: Request, cid: string): Response | null {
  const etag = etagForCid(cid);
  if (req.headers.get("If-None-Match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": OBJECT_FILE_CACHE_CONTROL,
      },
    });
  }
  return null;
}

export function binaryResponseWithCache(opts: {
  req: Request;
  bytes: Uint8Array;
  contentType: string;
  cid: string;
}): Response {
  const early = notModifiedIfMatch(opts.req, opts.cid);
  if (early) return early;

  const etag = etagForCid(opts.cid);
  return new Response(new Blob([new Uint8Array(opts.bytes)]), {
    status: 200,
    headers: {
      "Content-Type": opts.contentType,
      ETag: etag,
      "Cache-Control": OBJECT_FILE_CACHE_CONTROL,
    },
  });
}

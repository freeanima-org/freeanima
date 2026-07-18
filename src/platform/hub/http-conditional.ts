/** Hub REST JSON GET 的 ETag / If-None-Match → 304 */

const CACHE_CONTROL = "private, no-cache";

/** 对已序列化 JSON 文本生成强 ETag（与 body 字节一致） */
export function buildJsonBodyEtag(bodyText: string): string {
  const hash = new Bun.CryptoHasher("sha256").update(bodyText).digest("hex");
  return `"${hash}"`;
}

/** GET JSON：协商缓存；匹配则 304，否则 200 + body */
export function jsonResponseWithConditionalGet(req: Request, bodyText: string): Response {
  const etag = buildJsonBodyEtag(bodyText);
  const headers: Record<string, string> = {
    "Content-Type": "application/json;charset=utf-8",
    ETag: etag,
    "Cache-Control": CACHE_CONTROL,
  };

  const ifNoneMatch = req.headers.get("If-None-Match");
  if (ifNoneMatch !== null && ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(bodyText, { status: 200, headers });
}

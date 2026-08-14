import { describe, expect, it } from "bun:test";

import { binaryResponseWithCache, etagForCid, notModifiedIfMatch } from "./http-cache.ts";

describe("object-storage http-cache", () => {
  const cid = "0123456789abcdef0123456789abcdef";

  it("etagForCid quotes cid", () => {
    expect(etagForCid(cid)).toBe(`"${cid}"`);
  });

  it("notModifiedIfMatch returns 304 before body", () => {
    const req = new Request("http://x", {
      headers: { "If-None-Match": etagForCid(cid) },
    });
    const res = notModifiedIfMatch(req, cid);
    expect(res?.status).toBe(304);
  });

  it("binaryResponseWithCache 304 when If-None-Match matches", async () => {
    const req = new Request("http://x", {
      headers: { "If-None-Match": etagForCid(cid) },
    });
    const res = binaryResponseWithCache({
      req,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "application/octet-stream",
      cid,
    });
    expect(res.status).toBe(304);
    expect(await res.arrayBuffer()).toHaveLength(0);
  });

  it("binaryResponseWithCache 200 with ETag", async () => {
    const req = new Request("http://x");
    const res = binaryResponseWithCache({
      req,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "model/vrm",
      cid,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe(etagForCid(cid));
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    expect((await res.arrayBuffer()).byteLength).toBe(3);
  });
});

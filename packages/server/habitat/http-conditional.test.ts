import { describe, expect, test } from "bun:test";

import { buildJsonBodyEtag, jsonResponseWithConditionalGet } from "./http-conditional.ts";

describe("http-conditional", () => {
  test("buildJsonBodyEtag is stable for same body", () => {
    const body = JSON.stringify({ a: 1, b: ["x"] });
    expect(buildJsonBodyEtag(body)).toBe(buildJsonBodyEtag(body));
    expect(buildJsonBodyEtag(body)).not.toBe(buildJsonBodyEtag(JSON.stringify({ a: 2 })));
  });

  test("jsonResponseWithConditionalGet returns 200 with ETag", async () => {
    const body = JSON.stringify({ ok: true });
    const res = jsonResponseWithConditionalGet(new Request("http://127.0.0.1/x"), body);
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe(buildJsonBodyEtag(body));
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(await res.text()).toBe(body);
  });

  test("jsonResponseWithConditionalGet returns 304 when If-None-Match matches", async () => {
    const body = JSON.stringify({ ok: true });
    const etag = buildJsonBodyEtag(body);
    const res = jsonResponseWithConditionalGet(
      new Request("http://127.0.0.1/x", { headers: { "If-None-Match": etag } }),
      body,
    );
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe(etag);
    expect(await res.text()).toBe("");
  });

  test("jsonResponseWithConditionalGet returns 200 when If-None-Match mismatches", async () => {
    const body = JSON.stringify({ ok: true });
    const res = jsonResponseWithConditionalGet(
      new Request("http://127.0.0.1/x", { headers: { "If-None-Match": '"deadbeef"' } }),
      body,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(body);
  });
});

import { describe, expect, test } from "bun:test";

import { getHubMethodDef } from "@freeanima/shared/hub-contract";

import {
  appendPayloadToQuery,
  buildHubRestRequest,
  hubRpcRestPrefix,
  hubRestUrl,
  isNonJsonHubHttpMethod,
  parseHubRestResponse,
  parseQueryToPayload,
} from "./http-rest.ts";

describe("http-rest", () => {
  test("hubRpcRestPrefix", () => {
    expect(hubRpcRestPrefix()).toBe("/hub/rpc/v1");
  });

  test("appendPayloadToQuery and parseQueryToPayload roundtrip", () => {
    const params = new URLSearchParams();
    appendPayloadToQuery(
      params,
      { subject_kind: "user", tags: ["a", "b"], active: true, note: null },
      new Set(),
    );
    expect(params.toString()).toBe("subject_kind=user&tags=a&tags=b&active=true&note=");
    const parsed = parseQueryToPayload(params, new Set());
    expect(parsed).toEqual({
      subject_kind: "user",
      tags: ["a", "b"],
      active: true,
      note: "",
    });
  });

  test("hubRestUrl for tls.ca", () => {
    expect(hubRestUrl("http://127.0.0.1:2658", "tls.ca", {})).toBe(
      "http://127.0.0.1:2658/hub/rpc/v1/tls/ca",
    );
  });

  test("tls.ca.qr marked raw response", () => {
    const http = getHubMethodDef("tls.ca.qr").meta.http!;
    expect(http.response).toBe("raw");
  });

  test("isNonJsonHubHttpMethod console methods", () => {
    expect(isNonJsonHubHttpMethod("tls.ca")).toBe(true);
  });

  test("buildHubRestRequest sets If-None-Match for GET", () => {
    const { init } = buildHubRestRequest("http://127.0.0.1:2658", "status.get", {}, undefined, {
      ifNoneMatch: '"abc"',
    });
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe('"abc"');
  });

  test("parseHubRestResponse rejects 304", async () => {
    await expect(parseHubRestResponse(new Response(null, { status: 304 }))).rejects.toThrow(/304/);
  });
});

import { describe, expect, test } from "bun:test";

import { getHabitatMethodDef } from "@freeanima/shared/habitat-contract";

import {
  appendPayloadToQuery,
  buildHabitatRestRequest,
  habitatRpcRestPrefix,
  habitatRestUrl,
  isNonJsonHabitatHttpMethod,
  parseHabitatRestResponse,
  parseQueryToPayload,
} from "./http-rest.ts";

describe("http-rest", () => {
  test("habitatRpcRestPrefix", () => {
    expect(habitatRpcRestPrefix()).toBe("/rpc/v1");
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

  test("habitatRestUrl for tls.ca", () => {
    expect(habitatRestUrl("http://127.0.0.1:2658", "tls.ca", {})).toBe(
      "http://127.0.0.1:2658/rpc/v1/tls/ca",
    );
  });

  test("tls.ca.qr marked raw response", () => {
    const http = getHabitatMethodDef("tls.ca.qr").meta.http!;
    expect(http.response).toBe("raw");
  });

  test("isNonJsonHabitatHttpMethod console methods", () => {
    expect(isNonJsonHabitatHttpMethod("tls.ca")).toBe(true);
  });

  test("buildHabitatRestRequest sets If-None-Match for GET", () => {
    const { init } = buildHabitatRestRequest("http://127.0.0.1:2658", "status.get", {}, undefined, {
      ifNoneMatch: '"abc"',
    });
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe('"abc"');
  });

  test("parseHabitatRestResponse rejects 304", async () => {
    await expect(parseHabitatRestResponse(new Response(null, { status: 304 }))).rejects.toThrow(
      /304/,
    );
  });
});

import { describe, it, expect, afterEach } from "bun:test";
import { buildHttpRequestHeaders } from "./client.ts";

describe("buildHttpRequestHeaders", () => {
  const prev = process.env.MCP_TEST_TOKEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.MCP_TEST_TOKEN;
    else process.env.MCP_TEST_TOKEN = prev;
  });

  it("returns undefined when no headers and no api_key_env", () => {
    expect(buildHttpRequestHeaders({})).toBeUndefined();
  });

  it("passes through explicit headers", () => {
    expect(
      buildHttpRequestHeaders({
        headers: { Authorization: "Bearer explicit", "X-Foo": "bar" },
      }),
    ).toEqual({ Authorization: "Bearer explicit", "X-Foo": "bar" });
  });

  it("expands env() inside Authorization (post-migration shape)", () => {
    process.env.MCP_TEST_TOKEN = "secret-token";
    expect(
      buildHttpRequestHeaders({
        headers: { Authorization: 'Bearer env("MCP_TEST_TOKEN")' },
      }),
    ).toEqual({ Authorization: "Bearer secret-token" });
  });

  it("injects Bearer from api_key_env when Authorization absent", () => {
    process.env.MCP_TEST_TOKEN = "secret-token";
    expect(buildHttpRequestHeaders({ api_key_env: "MCP_TEST_TOKEN" })).toEqual({
      Authorization: "Bearer secret-token",
    });
  });

  it("does not override existing Authorization from api_key_env", () => {
    process.env.MCP_TEST_TOKEN = "secret-token";
    expect(
      buildHttpRequestHeaders({
        headers: { authorization: "Bearer keep-me" },
        api_key_env: "MCP_TEST_TOKEN",
      }),
    ).toEqual({ authorization: "Bearer keep-me" });
  });
});

import { describe, it, expect, afterEach } from "bun:test";
import { buildSseRequestHeaders } from "./client.ts";

describe("buildSseRequestHeaders", () => {
  const prev = process.env.MCP_TEST_TOKEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.MCP_TEST_TOKEN;
    else process.env.MCP_TEST_TOKEN = prev;
  });

  it("returns undefined when no headers and no api_key_env", () => {
    expect(buildSseRequestHeaders({})).toBeUndefined();
  });

  it("passes through explicit headers", () => {
    expect(
      buildSseRequestHeaders({
        headers: { Authorization: "Bearer explicit", "X-Foo": "bar" },
      }),
    ).toEqual({ Authorization: "Bearer explicit", "X-Foo": "bar" });
  });

  it("injects Bearer from api_key_env when Authorization absent", () => {
    process.env.MCP_TEST_TOKEN = "secret-token";
    expect(buildSseRequestHeaders({ api_key_env: "MCP_TEST_TOKEN" })).toEqual({
      Authorization: "Bearer secret-token",
    });
  });

  it("does not override existing Authorization from api_key_env", () => {
    process.env.MCP_TEST_TOKEN = "secret-token";
    expect(
      buildSseRequestHeaders({
        headers: { authorization: "Bearer keep-me" },
        api_key_env: "MCP_TEST_TOKEN",
      }),
    ).toEqual({ authorization: "Bearer keep-me" });
  });
});

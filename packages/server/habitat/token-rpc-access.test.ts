import { describe, expect, test } from "bun:test";

import { expandTokenPreset, FULL_TOKEN_AUTHORIZATION } from "@freeanima/shared/service-api-auth";

import { assertTokenRpcAccess, TokenAuthorizationError } from "./token-rpc-access.ts";

describe("assertTokenRpcAccess", () => {
  test("full allows tokens.*", () => {
    expect(() =>
      assertTokenRpcAccess({
        method: "tokens.createForSubject",
        authorization: FULL_TOKEN_AUTHORIZATION,
        access: "write",
      }),
    ).not.toThrow();
  });

  test("mcp preset denied on tokens.*", () => {
    expect(() =>
      assertTokenRpcAccess({
        method: "tokens.listForSubject",
        authorization: expandTokenPreset("mcp"),
        access: "read",
      }),
    ).toThrow(TokenAuthorizationError);
  });

  test("mcp preset allows chat read", () => {
    expect(() =>
      assertTokenRpcAccess({
        method: "chat.list",
        authorization: expandTokenPreset("mcp"),
        access: "read",
      }),
    ).not.toThrow();
  });

  test("extension denies tokens module", () => {
    expect(() =>
      assertTokenRpcAccess({
        method: "config.get",
        authorization: expandTokenPreset("extension"),
        access: "read",
      }),
    ).toThrow(TokenAuthorizationError);
  });
});

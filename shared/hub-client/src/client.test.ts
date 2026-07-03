import { describe, expect, test } from "bun:test";

import {
  getHubMethodDef,
  isHubMethod,
  resolveDefaultTransport,
  resolveFallbackTransport,
} from "@freeanima/hub-contract";
import { buildHttpUrl } from "./http-path.ts";

describe("hub-contract registry", () => {
  test("conversation.list is dual transport", () => {
    expect(isHubMethod("conversation.list")).toBe(true);
    const def = getHubMethodDef("conversation.list");
    expect(def.meta.transports).toEqual(["http", "ws"]);
    expect(resolveDefaultTransport(def.meta, "console")).toBe("http");
    expect(resolveDefaultTransport(def.meta, "satellite")).toBe("ws");
    expect(resolveFallbackTransport(def.meta, "http")).toBe("ws");
  });

  test("message.send is ws-only", () => {
    const def = getHubMethodDef("message.send");
    expect(def.meta.transports).toEqual(["ws"]);
    expect(def.meta.fallback).toBe(false);
  });

  test("mcp.status is http-only", () => {
    const def = getHubMethodDef("mcp.status");
    expect(def.meta.transports).toEqual(["http"]);
    expect(def.meta.http?.path).toBe("/api/mcp/status");
  });
});

describe("http-path", () => {
  test("resolves path params", () => {
    const url = buildHttpUrl(
      "http://127.0.0.1:2658",
      { method: "GET", path: "/api/conversations/{conversation_id}/messages" },
      { conversation_id: "abc", offset: 0 },
    );
    expect(url).toContain("/api/conversations/abc/messages");
    expect(url).toContain("offset=0");
  });
});

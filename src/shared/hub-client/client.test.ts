import { describe, expect, test } from "bun:test";

import {
  getHubMethodDef,
  isHubMethod,
  resolveDefaultTransport,
  resolveFallbackTransport,
} from "@freeanima/shared/hub-contract";

import { buildHubRpcHttpUrl } from "./http-rpc.ts";

describe("hub-contract registry", () => {
  test("conversation.list is dual transport without REST path", () => {
    expect(isHubMethod("conversation.list")).toBe(true);
    const def = getHubMethodDef("conversation.list");
    expect(def.meta.transports).toEqual(["http", "ws"]);
    expect(resolveDefaultTransport(def.meta, "console")).toBe("ws");
    expect(resolveDefaultTransport(def.meta, "satellite")).toBe("ws");
    expect(resolveFallbackTransport(def.meta, "ws")).toBe("http");
  });

  test("message.send is ws-only", () => {
    const def = getHubMethodDef("message.send");
    expect(def.meta.transports).toEqual(["ws"]);
    expect(def.meta.fallback).toBe(false);
  });

  test("mcp.status supports http and ws", () => {
    const def = getHubMethodDef("mcp.status");
    expect(def.meta.transports).toEqual(["http", "ws"]);
  });

  test("registry methods have no REST path binding", () => {
    for (const method of ["conversation.list", "status.get", "mcp.status"] as const) {
      const def = getHubMethodDef(method);
      expect((def.meta as { http?: unknown }).http).toBeUndefined();
    }
  });
});

describe("http-rpc", () => {
  test("buildHubRpcHttpUrl", () => {
    expect(buildHubRpcHttpUrl("http://127.0.0.1:2658")).toBe("http://127.0.0.1:2658/hub/rpc/v1");
  });
});

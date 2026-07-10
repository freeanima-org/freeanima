import { describe, expect, test } from "bun:test";

import {
  getHubMethodDef,
  isHubMethod,
  resolveDefaultTransport,
  resolveFallbackTransport,
} from "@freeanima/shared/hub-contract";

describe("hub-contract registry", () => {
  test("conversation.list is dual transport with REST meta", () => {
    expect(isHubMethod("conversation.list")).toBe(true);
    const def = getHubMethodDef("conversation.list");
    expect(def.meta.transports).toEqual(["http", "ws"]);
    expect(resolveDefaultTransport(def.meta, "console")).toBe("http");
    expect(resolveDefaultTransport(def.meta, "satellite")).toBe("http");
    expect(resolveFallbackTransport(def.meta, "http")).toBe("ws");
    expect(def.meta.http).toEqual({ verb: "GET", path: "conversation/list" });
  });

  test("message.send is ws-only", () => {
    const def = getHubMethodDef("message.send");
    expect(def.meta.transports).toEqual(["ws"]);
    expect(def.meta.fallback).toBe(false);
    expect(def.meta.http).toBeUndefined();
  });

  test("mcp.status supports http and ws with REST meta", () => {
    const def = getHubMethodDef("mcp.status");
    expect(def.meta.transports).toEqual(["http", "ws"]);
    expect(def.meta.http?.verb).toBe("GET");
  });

  test("dual-transport methods have http REST binding", () => {
    for (const method of ["conversation.list", "status.get", "mcp.status"] as const) {
      const def = getHubMethodDef(method);
      expect(def.meta.http).toBeDefined();
      expect(def.meta.http?.path.length).toBeGreaterThan(0);
    }
  });

  test("vault.get uses POST for sensitive read", () => {
    const def = getHubMethodDef("vault.get");
    expect(def.meta.http).toEqual({
      verb: "POST",
      path: "vault/get/:id",
      pathParams: ["id"],
    });
  });
});

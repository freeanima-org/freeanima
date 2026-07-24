import { beforeAll, describe, expect, test } from "bun:test";

import {
  getHabitatMethodDef,
  isHabitatMethod,
  resolveDefaultTransport,
  resolveFallbackTransport,
  type HabitatMethodDef,
} from "@freeanima/shared/habitat-contract";
import { FEATURE_METHOD_DEFS } from "./feature-method-defs.ts";
import { STATIC_METHOD_REGISTRY } from "@freeanima/shared/habitat-contract/registry/index.ts";
import { isNonJsonHabitatHttpMethod } from "@freeanima/shared/habitat-rpc";
import {
  initHabitatRouter,
  resetHabitatRouterForTests,
} from "@freeanima/host/platform/habitat/init.ts";
import { habitatRouter } from "@freeanima/host/platform/habitat/habitat-router.ts";
import { resetHabitatMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

describe("habitat method registry (runtime SSOT)", () => {
  beforeAll(() => {
    resetHabitatMethodRegistryForTests();
    resetHabitatRouterForTests();
    initHabitatRouter();
  });

  test("feature method-defs 与 habitatRouter.defs 对齐", () => {
    const clientKeys = new Set([
      ...Object.keys(STATIC_METHOD_REGISTRY),
      ...Object.keys(FEATURE_METHOD_DEFS),
    ]);
    const serverKeys = new Set(Object.keys(habitatRouter.defs));
    expect(clientKeys).toEqual(serverKeys);
    const clientDefs: Record<string, HabitatMethodDef> = {
      ...STATIC_METHOD_REGISTRY,
      ...FEATURE_METHOD_DEFS,
    };
    const serverDefs = habitatRouter.defs as Record<string, HabitatMethodDef>;
    for (const method of serverKeys) {
      const serverDef = serverDefs[method];
      const clientDef = clientDefs[method];
      expect(clientDef).toBeDefined();
      expect(clientDef!.meta.transports).toEqual(serverDef!.meta.transports);
      expect(clientDef!.meta.fallback).toBe(serverDef!.meta.fallback);
    }
  });

  test("conversation.list is dual transport with REST meta", () => {
    expect(isHabitatMethod("conversation.list")).toBe(true);
    const def = getHabitatMethodDef("conversation.list");
    expect(def.meta.transports).toEqual(["http", "ws"]);
    expect(resolveDefaultTransport(def.meta, "habitat")).toBe("http");
    expect(resolveDefaultTransport(def.meta, "outpost")).toBe("http");
    expect(resolveFallbackTransport(def.meta, "http")).toBe("ws");
    expect(def.meta.http).toEqual({ verb: "GET", path: "conversation/list" });
  });

  test("message.send is ws-only", () => {
    const def = getHabitatMethodDef("message.send");
    expect(def.meta.transports).toEqual(["ws"]);
    expect(def.meta.fallback).toBe(false);
    expect(def.meta.http).toBeUndefined();
  });

  test("mcp.status supports http and ws with REST meta", () => {
    const def = getHabitatMethodDef("mcp.status");
    expect(def.meta.transports).toEqual(["http", "ws"]);
    expect(def.meta.http?.verb).toBe("GET");
  });

  test("dual-transport methods have http REST binding", () => {
    for (const method of ["conversation.list", "status.get", "mcp.status"] as const) {
      const def = getHabitatMethodDef(method);
      expect(def.meta.http).toBeDefined();
      expect(def.meta.http?.path.length).toBeGreaterThan(0);
    }
  });

  test("vault.get uses POST for sensitive read", () => {
    const def = getHabitatMethodDef("vault.get");
    expect(def.meta.http).toEqual({
      verb: "POST",
      path: "vault/get/:id",
      pathParams: ["id"],
    });
  });

  test("tls.ca uses raw HTTP response", () => {
    const def = getHabitatMethodDef("tls.ca");
    expect(def.meta.http?.response).toBe("raw");
    expect(isNonJsonHabitatHttpMethod("tls.ca")).toBe(true);
  });

  test("companion.asset.get is raw GET", () => {
    const def = getHabitatMethodDef("companion.asset.get");
    expect(def.meta.http).toEqual({
      verb: "GET",
      path: "companion/assets/:kind/:fileName",
      pathParams: ["kind", "fileName"],
      response: "raw",
    });
  });
});

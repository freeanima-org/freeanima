import { beforeAll, describe, expect, test } from "bun:test";

import {
  COMPILED_ROUTES,
  compileHttpRoutesFromRegistry,
  findRoute,
  hubRestRelativePath,
  matchPattern,
  resetCompiledHttpRoutes,
} from "./http-rest-router.ts";
import { initHubRouter, resetHubRouterForTests } from "./init.ts";
import { resetHubMethodRegistryForTests } from "@freeanima/shared/hub-contract/registry/runtime.ts";

describe("http-rest-router", () => {
  beforeAll(() => {
    resetHubMethodRegistryForTests();
    resetHubRouterForTests();
    resetCompiledHttpRoutes();
    initHubRouter();
    compileHttpRoutesFromRegistry();
  });

  test("hubRestRelativePath", () => {
    expect(hubRestRelativePath("/hub/rpc/v1/task/list")).toBe("task/list");
    expect(hubRestRelativePath("/hub/rpc/v1")).toBeNull();
    expect(hubRestRelativePath("/api/health")).toBeNull();
  });

  test("matchPattern with id param", () => {
    expect(matchPattern("task/get/:id", "task/get/42")).toEqual({ id: "42" });
    expect(matchPattern("task/get/:id", "task/get")).toBeNull();
    expect(matchPattern("task/list", "task/list")).toEqual({});
  });

  test("findRoute GET task.list", () => {
    const match = findRoute("GET", "task/list");
    expect(match?.entry.hubMethod).toBe("task.list");
  });

  test("findRoute POST task.create", () => {
    const match = findRoute("POST", "task/create");
    expect(match?.entry.hubMethod).toBe("task.create");
  });

  test("vault.get is POST route", () => {
    const getMatch = findRoute("GET", "vault/get/1");
    expect(getMatch).toBeNull();
    const postMatch = findRoute("POST", "vault/get/1");
    expect(postMatch?.entry.hubMethod).toBe("vault.get");
  });

  test("findRoute GET tls.ca raw method", () => {
    const match = findRoute("GET", "tls/ca");
    expect(match?.entry.hubMethod).toBe("tls.ca");
    expect(match?.entry.http.response).toBe("raw");
  });

  test("findRoute GET companion.asset.get", () => {
    const match = findRoute("GET", "companion/assets/models/demo.vrm");
    expect(match?.entry.hubMethod).toBe("companion.asset.get");
    expect(match?.pathValues).toEqual({ kind: "models", fileName: "demo.vrm" });
  });

  test("findRoute POST tts.synthesize raw method", () => {
    const match = findRoute("POST", "tts/synthesize");
    expect(match?.entry.hubMethod).toBe("tts.synthesize");
    expect(match?.entry.http.response).toBe("raw");
  });

  test("compiled routes have unique verb+path", () => {
    const seen = new Set<string>();
    for (const verb of ["GET", "POST"] as const) {
      for (const entry of COMPILED_ROUTES[verb]) {
        const key = `${verb}:${entry.http.path}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});

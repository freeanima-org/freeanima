import { beforeAll, describe, expect, test } from "bun:test";

import {
  COMPILED_ROUTES,
  compileHttpRoutesFromRegistry,
  findRoute,
  habitatRestRelativePath,
  matchPattern,
  resetCompiledHttpRoutes,
} from "./http-rest-router.ts";
import { initHabitatRouter, resetHabitatRouterForTests } from "./init.ts";
import { resetHabitatMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

describe("http-rest-router", () => {
  beforeAll(() => {
    resetHabitatMethodRegistryForTests();
    resetHabitatRouterForTests();
    resetCompiledHttpRoutes();
    initHabitatRouter();
    compileHttpRoutesFromRegistry();
  });

  test("habitatRestRelativePath", () => {
    expect(habitatRestRelativePath("/rpc/v1/task/list")).toBe("task/list");
    expect(habitatRestRelativePath("/rpc/v1")).toBeNull();
    expect(habitatRestRelativePath("/api/health")).toBeNull();
  });

  test("matchPattern with id param", () => {
    expect(matchPattern("task/get/:id", "task/get/42")).toEqual({ id: "42" });
    expect(matchPattern("task/get/:id", "task/get")).toBeNull();
    expect(matchPattern("task/list", "task/list")).toEqual({});
  });

  test("findRoute GET tasklist.item.list", () => {
    const match = findRoute("GET", "tasklist/item/list");
    expect(match?.entry.hubMethod).toBe("tasklist.item.list");
  });

  test("findRoute POST tasklist.item.create", () => {
    const match = findRoute("POST", "tasklist/item/create");
    expect(match?.entry.hubMethod).toBe("tasklist.item.create");
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

  test("findRoute GET object_storage.file.get", () => {
    const match = findRoute("GET", "object_storage/file/42");
    expect(match?.entry.hubMethod).toBe("object_storage.file.get");
    expect(match?.pathValues).toEqual({ id: "42" });
    expect(match?.entry.http.response).toBe("raw");
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

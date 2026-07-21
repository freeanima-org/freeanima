import { describe, expect, test } from "bun:test";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { listHubMethods } from "@freeanima/shared/habitat-contract";
import { wsOnlyMethodDefs } from "@freeanima/shared/habitat-contract/registry/ws-only.ts";
import { resetHubMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import type { SapServerDeps } from "../sap/types.ts";
import { builtinFeaturePlugins } from "./builtin-plugins.ts";
import { resetHubRouterForTests } from "../habitat/init.ts";
import { resetCompiledHttpRoutes } from "../habitat/http-rest-router.ts";
import {
  getFeatureRpcHandler,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";

const WS_ONLY_DISPATCH_METHODS = new Set(Object.keys(wsOnlyMethodDefs));

describe("registerFeatures", () => {
  test("registers feature RPC handler lookup", async () => {
    resetFeatureRegistryForTests();
    resetHubMethodRegistryForTests();
    resetHubRouterForTests();
    resetCompiledHttpRoutes();
    const deps = {} as SapServerDeps;
    const ctx = {
      app_id: "x",
      instance_id: "y",
      auth: {
        subject_id: 1,
        subject_type: "user" as const,
        token_id: 1,
        scopes: [],
      },
      sendEvent: () => {},
    } satisfies SapRequestContext;
    registerFeatures([
      {
        id: "mock",
        habitat: {
          rpc: {
            "mock.echo": async () => ({ ok: true }),
          },
        },
      },
    ]);
    const handler = getFeatureRpcHandler("mock.echo");
    expect(handler).toBeDefined();
    await expect(handler!(deps, {}, ctx)).resolves.toEqual({
      ok: true,
    });
  });

  test("builtin plugins register a handler for every hub-dispatch method", () => {
    resetFeatureRegistryForTests();
    resetHubMethodRegistryForTests();
    resetHubRouterForTests();
    resetCompiledHttpRoutes();
    registerFeatures(builtinFeaturePlugins);

    const missing: string[] = [];
    for (const method of listHubMethods()) {
      if (WS_ONLY_DISPATCH_METHODS.has(method)) continue;
      if (!getFeatureRpcHandler(method)) {
        missing.push(method);
      }
    }

    expect(missing).toEqual([]);
  });
});

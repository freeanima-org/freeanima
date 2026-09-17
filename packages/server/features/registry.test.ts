import { describe, expect, test } from "bun:test";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { resetHabitatMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import type { RemoteToolsServerDeps } from "@freeanima/capabilities/outpost/transport/types.ts";
import { builtinFeaturePlugins } from "./builtin-feature-plugins.ts";
import { createFeaturePlugin } from "./plugin.ts";
import { getFeatureService } from "./service.ts";
import { resetHabitatRouterForTests } from "../habitat/init.ts";
import { habitatRouter } from "../habitat/habitat-router.ts";
import { resetCompiledHttpRoutes } from "../habitat/http-rest-router.ts";
import {
  getFeatureRpcHandler,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";

describe("registerFeatures", () => {
  test("registers feature RPC handler lookup", async () => {
    resetFeatureRegistryForTests();
    resetHabitatMethodRegistryForTests();
    resetHabitatRouterForTests();
    resetCompiledHttpRoutes();
    const deps = {} as RemoteToolsServerDeps;
    const ctx = {
      app_id: "x",
      instance_id: "y",
      auth: {
        subject_id: 1,
        subject_type: "user" as const,
        token_id: 1,
        authorization: { full: true },
      },
      sendEvent: () => {},
    } satisfies RemoteToolsRequestContext;
    registerFeatures([
      createFeaturePlugin({
        id: "mock",
        rpc: {
          "mock.echo": async () => ({ ok: true }),
        },
      }),
    ]);
    const handler = getFeatureRpcHandler("mock.echo");
    expect(handler).toBeDefined();
    await expect(handler!(deps, {}, ctx)).resolves.toEqual({
      ok: true,
    });
  });

  test("builtin plugins cover exactly the habitat router methods", () => {
    resetFeatureRegistryForTests();
    resetHabitatMethodRegistryForTests();
    resetHabitatRouterForTests();
    resetCompiledHttpRoutes();
    registerFeatures(builtinFeaturePlugins);

    const service = getFeatureService();
    expect(service).toBeDefined();
    const handled = new Set(service?.listHandledMethods() ?? []);
    expect(handled).toEqual(new Set(Object.keys(habitatRouter.defs)));
    for (const method of Object.keys(habitatRouter.defs)) {
      expect(getFeatureRpcHandler(method)).toBeDefined();
    }
  });
});

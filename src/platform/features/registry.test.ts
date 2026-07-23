import { describe, expect, test } from "bun:test";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { listHabitatMethods } from "@freeanima/shared/habitat-contract";
import { wsOnlyMethodDefs } from "@freeanima/shared/habitat-contract/registry/ws-only.ts";
import { resetHabitatMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import type { RemoteToolsServerDeps } from "../remote-tools/types.ts";
import { builtinFeaturePlugins } from "./builtin-plugins.ts";
import { resetHabitatRouterForTests } from "../habitat/init.ts";
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
        scopes: [],
      },
      sendEvent: () => {},
    } satisfies RemoteToolsRequestContext;
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

  test("builtin plugins register a handler for every habitat-dispatch method", () => {
    resetFeatureRegistryForTests();
    resetHabitatMethodRegistryForTests();
    resetHabitatRouterForTests();
    resetCompiledHttpRoutes();
    registerFeatures(builtinFeaturePlugins);

    const missing: string[] = [];
    for (const method of listHabitatMethods()) {
      if (WS_ONLY_DISPATCH_METHODS.has(method)) continue;
      if (!getFeatureRpcHandler(method)) {
        missing.push(method);
      }
    }

    expect(missing).toEqual([]);
  });
});

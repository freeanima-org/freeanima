import { describe, expect, test } from "bun:test";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { listHubMethods } from "@freeanima/shared/hub-contract";
import { wsOnlyMethodDefs } from "@freeanima/shared/hub-contract/registry/ws-only.ts";

import type { SapServerDeps } from "../sap/types.ts";
import { builtinFeaturePlugins } from "./builtin-plugins.ts";
import {
  getFeatureRpcHandler,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";

const WS_ONLY_DISPATCH_METHODS = new Set(Object.keys(wsOnlyMethodDefs));

describe("registerFeatures", () => {
  test("registers feature RPC handler lookup", async () => {
    resetFeatureRegistryForTests();
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
        hub: {
          rpc: {
            "task.list": async () => ({ tasks: [] }),
          },
        },
      },
    ]);
    const handler = getFeatureRpcHandler("task.list");
    expect(handler).toBeDefined();
    await expect(handler!(deps, {}, ctx)).resolves.toEqual({
      tasks: [],
    });
  });

  test("builtin plugins register a handler for every hub-dispatch method", () => {
    resetFeatureRegistryForTests();
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

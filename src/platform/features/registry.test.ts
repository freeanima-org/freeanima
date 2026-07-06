import { describe, expect, test } from "bun:test";
import type { SapRequestContext } from "@freeanima/sap-contract";

import type { SapServerDeps } from "../sap/types.ts";
import {
  getFeatureRpcHandler,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";

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
});

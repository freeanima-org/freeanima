import { describe, expect, it } from "bun:test";
import { createHookContext } from "@freeanima/habitat/core/hooks/cordis";
import type { Kernel } from "@freeanima/kernel";
import { RuntimeService, type RuntimeContext } from "./runtime-service.ts";

function stubRuntime(): RuntimeContext {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- minimal stub for the service seam
  return { deps: {}, app: {}, kernel: {} } as RuntimeContext;
}

const tick = async (): Promise<void> => {
  await new Promise<void>((r) => {
    setTimeout(r, 0);
  });
};

describe("RuntimeService (Cordis service seam)", () => {
  it("registers a typed ctx.appRuntime", async () => {
    const ctx = createHookContext();
    const runtime = stubRuntime();
    await ctx.plugin(RuntimeService, { runtime });
    expect(ctx.appRuntime).toBeDefined();
    expect(ctx.appRuntime.deps).toBe(runtime.deps);
    expect(ctx.appRuntime.kernel).toBe(runtime.kernel);
  });

  it("defers inject until the service is provided, then reclaims on dispose", async () => {
    const ctx = createHookContext();
    const seen: Kernel[] = [];
    ctx.plugin((inner) => {
      inner.inject(["appRuntime"], (scope) => {
        seen.push(scope.appRuntime.kernel);
      });
    });
    await tick();
    expect(seen).toEqual([]);

    const runtime = stubRuntime();
    const fiber = ctx.plugin(RuntimeService, { runtime });
    await fiber;
    await tick();
    expect(seen).toEqual([runtime.kernel]);

    await fiber.dispose();
    expect(ctx.appRuntime).toBeUndefined();
  });
});

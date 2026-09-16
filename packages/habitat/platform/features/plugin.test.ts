import { describe, expect, test } from "bun:test";
import { Context } from "cordis";

import { createFeaturePlugin } from "./plugin.ts";
import { mountFeatureService } from "./service.ts";

describe("createFeaturePlugin", () => {
  test("provides on activate and revokes on dispose, allowing re-mount", async () => {
    const ctx = new Context();
    const features = mountFeatureService(ctx);

    const fiber = await ctx.plugin(
      createFeaturePlugin({ id: "demo", rpc: { "demo.echo": async () => 1 } }),
    );
    expect(features.getHandler("demo.echo")).toBeDefined();
    expect(features.getContribution("demo")).toBeDefined();

    await fiber.dispose();
    expect(features.getHandler("demo.echo")).toBeUndefined();
    expect(features.getContribution("demo")).toBeUndefined();

    const reloaded = await ctx.plugin(
      createFeaturePlugin({ id: "demo", rpc: { "demo.echo": async () => 2 } }),
    );
    expect(features.getHandler("demo.echo")).toBeDefined();
    await reloaded.dispose();
  });
});

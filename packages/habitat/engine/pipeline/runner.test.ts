import { afterEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

import { resetActiveConfigForTest } from "@freeanima/habitat/core/config";

import { PipelineRunner } from "./runner.ts";
import { readPipelineRunState, resetPipelineRunStateForTests } from "./state.ts";
import type { PipelineDefinition } from "./types.ts";

const TEST_HOME = join("/tmp", `anima-pipeline-test-${process.pid}`);

const linearDef: PipelineDefinition = {
  id: "test-linear",
  nodes: [
    { id: "a", handler: "a" },
    { id: "b", handler: "b", dependsOn: ["a"] },
    { id: "c", handler: "c", dependsOn: ["b"], optional: true },
  ],
};

describe("PipelineRunner", () => {
  const order: string[] = [];
  const prevHome = process.env.FREEANIMA_HOME;

  afterEach(() => {
    order.length = 0;
    resetActiveConfigForTest();
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    resetPipelineRunStateForTests("test-linear");
    if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true, force: true });
  });

  function bindTestHome(): void {
    process.env.FREEANIMA_HOME = TEST_HOME;
  }

  it("runs nodes in topological order", async () => {
    bindTestHome();
    const runner = new PipelineRunner();
    runner.registerDefinition(linearDef);
    runner.registerStep("a", async () => {
      order.push("a");
      return { ok: true, output: { n: 1 } };
    });
    runner.registerStep("b", async () => {
      order.push("b");
      return { ok: true };
    });
    runner.registerStep("c", async () => {
      order.push("c");
      return { ok: true };
    });

    const result = await runner.run("test-linear", { day: "2026-06-14" });
    expect(result.ok).toBe(true);
    expect(order).toEqual(["a", "b", "c"]);
    expect(result.steps.a?.status).toBe("completed");
    expect(result.steps.b?.status).toBe("completed");

    const persisted = readPipelineRunState("test-linear");
    expect(persisted?.day).toBe("2026-06-14");
    expect(persisted?.status).toBe("completed");
  });

  it("skips node when skipIf returns true", async () => {
    bindTestHome();
    const runner = new PipelineRunner();
    runner.registerDefinition({
      id: "test-linear",
      nodes: [{ id: "a", handler: "a", skipIf: () => true }],
    });
    runner.registerStep("a", async () => ({ ok: true }));

    const result = await runner.run("test-linear");
    expect(result.steps.a?.status).toBe("skipped");
    expect(result.steps.a?.skipped_reason).toBe("skipIf");
  });

  it("runStep rejects when dependencies missing", async () => {
    bindTestHome();
    const runner = new PipelineRunner();
    runner.registerDefinition(linearDef);
    runner.registerStep("b", async () => ({ ok: true }));

    const result = await runner.runStep("b", { day: "2026-06-14" });
    expect(result.ok).toBe(false);
    expect(result.dependency_error).toContain("a");
  });

  it("runStep with force bypasses dependencies", async () => {
    bindTestHome();
    const runner = new PipelineRunner();
    runner.registerDefinition(linearDef);
    runner.registerStep("b", async () => ({ ok: true, output: { forced: true } }));

    const result = await runner.runStep("b", { force: true });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");
  });

  it("invokes stepFinishedListener on each finished step", async () => {
    bindTestHome();
    const events: string[] = [];
    const runner = new PipelineRunner();
    runner.registerDefinition(linearDef);
    runner.setStepFinishedListener(async (event) => {
      events.push(`${event.step_id}:${event.status}`);
    });
    runner.registerStep("a", async () => ({ ok: true }));
    runner.registerStep("b", async () => ({ ok: true }));
    runner.registerStep("c", async () => ({ ok: true }));

    await runner.run("test-linear", { day: "2026-06-14", trigger: "scheduled" });
    expect(events).toEqual(["a:completed", "b:completed", "c:completed"]);
  });

  it("stops required downstream after failure", async () => {
    bindTestHome();
    const runner = new PipelineRunner();
    runner.registerDefinition(linearDef);
    runner.registerStep("a", async () => ({ ok: false, error: "boom" }));
    runner.registerStep("b", async () => {
      order.push("b");
      return { ok: true };
    });
    runner.registerStep("c", async () => {
      order.push("c");
      return { ok: true };
    });

    const result = await runner.run("test-linear");
    expect(result.ok).toBe(false);
    expect(result.steps.a?.status).toBe("failed");
    expect(result.steps.b?.status).toBe("skipped");
    expect(order).toEqual([]);
  });
});

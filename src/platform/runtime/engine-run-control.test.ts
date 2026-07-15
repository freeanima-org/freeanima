import { describe, it, expect } from "bun:test";
import { EngineRunControl } from "./engine-run-control.ts";

describe("EngineRunControl.abortAll", () => {
  it("aborts engine run for all active conversations", () => {
    const ctrl = new EngineRunControl();
    const a = ctrl.beginEngineRun("s1");
    const b = ctrl.beginEngineRun("s2");
    expect(a.signal.aborted).toBe(false);
    expect(b.signal.aborted).toBe(false);

    ctrl.abortAll();

    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(true);
  });

  it("in-flight count returns to zero after release following abort", async () => {
    const ctrl = new EngineRunControl();
    ctrl.acquireInFlight();
    ctrl.beginEngineRun("s1");
    ctrl.abortAll();
    ctrl.releaseInFlight();
    await ctrl.waitForDrain();
    expect(ctrl.getInFlightCount()).toBe(0);
  });
});

describe("EngineRunControl client_op lock", () => {
  it("同 client_op_id 第二次 tryAcquire 失败直到 release", () => {
    const ctrl = new EngineRunControl();
    expect(ctrl.tryAcquireClientOp("op-1")).toBe(true);
    expect(ctrl.tryAcquireClientOp("op-1")).toBe(false);
    ctrl.releaseClientOp("op-1");
    expect(ctrl.tryAcquireClientOp("op-1")).toBe(true);
    ctrl.releaseClientOp("op-1");
  });

  it("不同 client_op_id 可并行占用", () => {
    const ctrl = new EngineRunControl();
    expect(ctrl.tryAcquireClientOp("a")).toBe(true);
    expect(ctrl.tryAcquireClientOp("b")).toBe(true);
    ctrl.releaseClientOp("a");
    ctrl.releaseClientOp("b");
  });
});

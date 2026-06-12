import { describe, it, expect } from "bun:test";
import { EngineRunControl } from "./engine-run-control.ts";

describe("EngineRunControl.abortAll", () => {
  it("aborts engine run for all active sessions", () => {
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

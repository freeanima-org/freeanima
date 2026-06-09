import { describe, it, expect } from "bun:test";
import { EngineRunControl } from "./engine-run-control.ts";

describe("EngineRunControl.abortAll", () => {
  it("abort 所有活跃 session 的 engine run", () => {
    const ctrl = new EngineRunControl();
    const a = ctrl.beginEngineRun("s1");
    const b = ctrl.beginEngineRun("s2");
    expect(a.signal.aborted).toBe(false);
    expect(b.signal.aborted).toBe(false);

    ctrl.abortAll();

    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(true);
  });

  it("abort 后 in-flight 可在 release 后归零", async () => {
    const ctrl = new EngineRunControl();
    ctrl.acquireInFlight();
    ctrl.beginEngineRun("s1");
    ctrl.abortAll();
    ctrl.releaseInFlight();
    await ctrl.waitForDrain();
    expect(ctrl.getInFlightCount()).toBe(0);
  });
});

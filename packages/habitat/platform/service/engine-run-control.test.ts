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

describe("EngineRunControl cancelNextBegin", () => {
  it("prepare 前 interrupt 使随后 beginEngineRun 的 signal 已 aborted", () => {
    const ctrl = new EngineRunControl();
    ctrl.interruptSessionEngine("s1");
    const run = ctrl.beginEngineRun("s1");
    expect(run.signal.aborted).toBe(true);
  });

  it("cancelNextBegin 只消费一次，下一轮 send 不被误杀", () => {
    const ctrl = new EngineRunControl();
    ctrl.interruptSessionEngine("s1");
    const first = ctrl.beginEngineRun("s1");
    expect(first.signal.aborted).toBe(true);
    ctrl.endEngineRun("s1", first.controller);
    const second = ctrl.beginEngineRun("s1");
    expect(second.signal.aborted).toBe(false);
  });

  it("进行中 abort 不误杀随后的新一轮", () => {
    const ctrl = new EngineRunControl();
    const first = ctrl.beginEngineRun("s1");
    ctrl.interruptSessionEngine("s1");
    expect(first.signal.aborted).toBe(true);
    ctrl.endEngineRun("s1", first.controller);
    const second = ctrl.beginEngineRun("s1");
    expect(second.signal.aborted).toBe(false);
  });

  it("preempt 仅结束上一轮，不取消即将 begin 的新 send", () => {
    const ctrl = new EngineRunControl();
    ctrl.preemptSessionEngine("s1");
    const run = ctrl.beginEngineRun("s1");
    expect(run.signal.aborted).toBe(false);
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

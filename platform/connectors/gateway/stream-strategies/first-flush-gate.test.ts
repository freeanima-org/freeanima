import { afterEach, describe, expect, it } from "bun:test";

import { createFirstFlushGate } from "./first-flush-gate.ts";

describe("createFirstFlushGate", () => {
  afterEach(() => {
    // Bun test timers
  });

  it("未达 minChars 且未超时时不触发", async () => {
    const gate = createFirstFlushGate({ minChars: 10, maxWaitMs: 500 });
    let called = false;
    gate.onDelta("短", () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(gate.isOpen()).toBe(false);
    gate.dispose();
  });

  it("达到 minChars 时立即触发", async () => {
    const gate = createFirstFlushGate({ minChars: 5, maxWaitMs: 500 });
    let called = false;
    gate.onDelta("12345", () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(gate.isOpen()).toBe(true);
    gate.dispose();
  });

  it("超时但未达 minChars 时触发", async () => {
    const gate = createFirstFlushGate({ minChars: 30, maxWaitMs: 50 });
    let called = false;
    gate.onDelta("短", () => {
      called = true;
    });
    expect(called).toBe(false);
    await new Promise<void>((r) => {
      setTimeout(r, 80);
    });
    expect(called).toBe(true);
    expect(gate.isOpen()).toBe(true);
    gate.dispose();
  });

  it("flushPending 在短回答场景强制触发", async () => {
    const gate = createFirstFlushGate({ minChars: 30, maxWaitMs: 500 });
    let called = false;
    gate.onDelta("短", () => {
      called = true;
    });
    expect(called).toBe(false);
    await gate.flushPending(() => {
      called = true;
    });
    expect(called).toBe(true);
    expect(gate.isOpen()).toBe(true);
    gate.dispose();
  });

  it("gate 已开后 onDelta 不再触发", async () => {
    const gate = createFirstFlushGate({ minChars: 1, maxWaitMs: 500 });
    let count = 0;
    gate.onDelta("a", () => {
      count += 1;
    });
    expect(count).toBe(1);
    gate.onDelta("ab", () => {
      count += 1;
    });
    expect(count).toBe(1);
    gate.dispose();
  });
});

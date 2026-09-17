import { describe, expect, it } from "bun:test";

import {
  AUTO_PERSIST_LONG,
  AUTO_PERSIST_SHORT,
  createAutoPersistScheduler,
} from "./auto-persist-schedule.ts";

type FakeTimer = { id: number; at: number; fn: () => void };

function createFakeClock() {
  let nowMs = 0;
  let nextId = 1;
  const timers: FakeTimer[] = [];

  const now = () => nowMs;

  const setTimeoutFn = (fn: () => void, ms: number) => {
    const id = nextId++;
    timers.push({ id, at: nowMs + ms, fn });
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  const clearTimeoutFn = (handle: unknown) => {
    const id = handle as number;
    const idx = timers.findIndex((t) => t.id === id);
    if (idx >= 0) timers.splice(idx, 1);
  };

  const advance = (ms: number) => {
    const target = nowMs + ms;
    while (true) {
      const due = timers
        .filter((t) => t.at <= target)
        .toSorted((a, b) => a.at - b.at || a.id - b.id);
      if (due.length === 0) {
        nowMs = target;
        return;
      }
      const next = due[0]!;
      nowMs = next.at;
      clearTimeoutFn(next.id);
      next.fn();
    }
  };

  return {
    now,
    setTimeoutFn,
    clearTimeoutFn,
    advance,
    get nowMs() {
      return nowMs;
    },
  };
}

describe("AUTO_PERSIST presets", () => {
  it("长文本为 1s 防抖 + 5s 节流窗口", () => {
    expect(AUTO_PERSIST_LONG).toEqual({ debounceMs: 1000, maxWaitMs: 5000 });
  });

  it("短文本为 400ms 防抖 + 2s 节流窗口", () => {
    expect(AUTO_PERSIST_SHORT).toEqual({ debounceMs: 400, maxWaitMs: 2000 });
  });
});

describe("createAutoPersistScheduler", () => {
  it("闲置满 debounceMs 后触发一次", () => {
    const clock = createFakeClock();
    let fires = 0;
    const s = createAutoPersistScheduler({
      debounceMs: 100,
      maxWaitMs: 1000,
      onFire: () => {
        fires += 1;
      },
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });

    s.schedule();
    clock.advance(99);
    expect(fires).toBe(0);
    clock.advance(1);
    expect(fires).toBe(1);
    expect(s.isPending()).toBe(false);
  });

  it("连续 schedule 重置防抖计时", () => {
    const clock = createFakeClock();
    let fires = 0;
    const s = createAutoPersistScheduler({
      debounceMs: 100,
      maxWaitMs: 1000,
      onFire: () => {
        fires += 1;
      },
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });

    s.schedule();
    clock.advance(80);
    s.schedule();
    clock.advance(80);
    expect(fires).toBe(0);
    clock.advance(20);
    expect(fires).toBe(1);
  });

  it("连续输入时在 maxWait 到期强制触发", () => {
    const clock = createFakeClock();
    let fires = 0;
    const s = createAutoPersistScheduler({
      debounceMs: 100,
      maxWaitMs: 250,
      onFire: () => {
        fires += 1;
      },
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });

    s.schedule();
    clock.advance(90);
    s.schedule();
    clock.advance(90);
    s.schedule();
    clock.advance(70);
    expect(fires).toBe(1);
  });

  it("cancel 取消待触发且不调用 onFire", () => {
    const clock = createFakeClock();
    let fires = 0;
    const s = createAutoPersistScheduler({
      debounceMs: 100,
      maxWaitMs: 1000,
      onFire: () => {
        fires += 1;
      },
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });

    s.schedule();
    s.cancel();
    clock.advance(500);
    expect(fires).toBe(0);
    expect(s.isPending()).toBe(false);
  });

  it("flush 立即触发并清空", () => {
    const clock = createFakeClock();
    let fires = 0;
    const s = createAutoPersistScheduler({
      debounceMs: 100,
      maxWaitMs: 1000,
      onFire: () => {
        fires += 1;
      },
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });

    s.schedule();
    s.flush();
    expect(fires).toBe(1);
    clock.advance(500);
    expect(fires).toBe(1);
  });

  it("无待触发时 flush 为空操作", () => {
    const clock = createFakeClock();
    let fires = 0;
    const s = createAutoPersistScheduler({
      debounceMs: 100,
      maxWaitMs: 1000,
      onFire: () => {
        fires += 1;
      },
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });

    s.flush();
    expect(fires).toBe(0);
  });

  it("maxWaitMs 小于 debounceMs 时抛错", () => {
    expect(() =>
      createAutoPersistScheduler({
        debounceMs: 100,
        maxWaitMs: 50,
        onFire: () => {},
      }),
    ).toThrow();
  });
});

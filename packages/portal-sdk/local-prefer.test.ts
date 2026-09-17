import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { HabitatRpcTimeoutError } from "@freeanima/shared/habitat-rpc";

import {
  clearLocalPrefer,
  isLocalPreferActive,
  isRecordableTransportFailure,
  recordHabitatTransportFailure,
  recordHabitatTransportSuccess,
  resetLocalPreferForTests,
  subscribeLocalPrefer,
} from "./local-prefer.ts";

describe("local-prefer", () => {
  beforeEach(() => {
    resetLocalPreferForTests();
  });

  afterEach(() => {
    resetLocalPreferForTests();
  });

  it("isRecordableTransportFailure 识别超时与业务错误", () => {
    expect(isRecordableTransportFailure(new HabitatRpcTimeoutError("timed out"))).toBe(true);
    expect(isRecordableTransportFailure(new Error("failed to fetch"))).toBe(true);
    expect(isRecordableTransportFailure(new Error("diary title is required"))).toBe(false);
  });

  it("单次传输失败不开启本地优先", () => {
    recordHabitatTransportFailure();
    expect(isLocalPreferActive()).toBe(false);
  });

  it("短窗内连续两次传输失败开启本地优先", () => {
    const seen: boolean[] = [];
    const unsub = subscribeLocalPrefer((active) => {
      seen.push(active);
    });
    recordHabitatTransportFailure();
    recordHabitatTransportFailure();
    expect(isLocalPreferActive()).toBe(true);
    expect(seen).toEqual([true]);
    unsub();
  });

  it("成功后重新计数，需再连续两次才开启", () => {
    recordHabitatTransportFailure();
    recordHabitatTransportSuccess();
    recordHabitatTransportFailure();
    expect(isLocalPreferActive()).toBe(false);
    recordHabitatTransportFailure();
    expect(isLocalPreferActive()).toBe(true);
  });

  it("clearLocalPrefer 退出本地优先", () => {
    recordHabitatTransportFailure();
    recordHabitatTransportFailure();
    expect(isLocalPreferActive()).toBe(true);
    clearLocalPrefer();
    expect(isLocalPreferActive()).toBe(false);
  });
});

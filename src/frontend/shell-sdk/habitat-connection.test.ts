import { afterEach, describe, expect, test } from "bun:test";

import {
  getHabitatRpcConnectionState,
  resetBundledHubRpcClientForTests,
} from "@freeanima/shared/habitat-rpc";

import { reconnectHabitat, subscribeHabitatConnection } from "./habitat-connection.ts";

describe("hub-connection", () => {
  afterEach(() => {
    resetBundledHubRpcClientForTests();
  });

  test("subscribeHabitatConnection 立即回调当前状态", () => {
    const states: string[] = [];
    const unsub = subscribeHabitatConnection((state) => states.push(state));
    expect(states).toEqual([getHabitatRpcConnectionState()]);
    unsub();
  });

  test("reconnectHabitat 导出为函数", () => {
    expect(typeof reconnectHabitat).toBe("function");
  });
});

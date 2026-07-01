import { afterEach, describe, expect, test } from "bun:test";

import { getHubRpcConnectionState, resetBundledHubRpcClientForTests } from "@freeanima/hub-rpc";

import { reconnectHub, subscribeHubConnection } from "./hub-connection.ts";

describe("hub-connection", () => {
  afterEach(() => {
    resetBundledHubRpcClientForTests();
  });

  test("subscribeHubConnection 立即回调当前状态", () => {
    const states: string[] = [];
    const unsub = subscribeHubConnection((state) => states.push(state));
    expect(states).toEqual([getHubRpcConnectionState()]);
    unsub();
  });

  test("reconnectHub 导出为函数", () => {
    expect(typeof reconnectHub).toBe("function");
  });
});

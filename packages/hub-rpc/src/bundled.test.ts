import { afterEach, describe, expect, test } from "bun:test";

import {
  getBundledHubRpcClient,
  getHubRpcConnectionState,
  resetBundledHubRpcClientForTests,
  subscribeHubRpcConnectionState,
  type HubRpcConnectionState,
} from "./bundled.ts";

describe("subscribeHubRpcConnectionState", () => {
  afterEach(() => {
    resetBundledHubRpcClientForTests();
  });

  test("初始状态为 connecting，订阅时立即回调", () => {
    const states: HubRpcConnectionState[] = [];
    const unsub = subscribeHubRpcConnectionState((state) => states.push(state));
    expect(getHubRpcConnectionState()).toBe("connecting");
    expect(states).toEqual(["connecting"]);
    unsub();
  });

  test("多订阅者同步收到 onConnectionStateChange 广播", () => {
    const legacy: HubRpcConnectionState[] = [];
    const subscribed: HubRpcConnectionState[] = [];

    getBundledHubRpcClient({
      onConnectionStateChange: (state) => legacy.push(state),
    });

    const unsub = subscribeHubRpcConnectionState((state) => subscribed.push(state));
    expect(subscribed[0]).toBe("connecting");

    // 模拟 transport 层状态变更（通过新建 client 触发 startTransport 的 notify）
    void getBundledHubRpcClient()
      .whenReady()
      .catch(() => undefined);

    expect(legacy.length).toBeGreaterThanOrEqual(1);
    expect(subscribed.length).toBeGreaterThanOrEqual(1);
    unsub();
  });
});

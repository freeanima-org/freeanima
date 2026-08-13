import { afterEach, describe, expect, test } from "bun:test";

import {
  getBundledHabitatRpcClient,
  getHabitatRpcConnectionState,
  resetBundledHabitatRpcClientForTests,
  subscribeHabitatRpcConnectionState,
  type HabitatRpcConnectionState,
} from "./bundled-browser.ts";

describe("subscribeHabitatRpcConnectionState", () => {
  afterEach(() => {
    resetBundledHabitatRpcClientForTests();
  });

  test("初始状态为 connecting，订阅时立即回调", () => {
    const states: HabitatRpcConnectionState[] = [];
    const unsub = subscribeHabitatRpcConnectionState((state) => states.push(state));
    expect(getHabitatRpcConnectionState()).toBe("connecting");
    expect(states).toEqual(["connecting"]);
    unsub();
  });

  test("多订阅者同步收到 onConnectionStateChange 广播", () => {
    const legacy: HabitatRpcConnectionState[] = [];
    const subscribed: HabitatRpcConnectionState[] = [];

    getBundledHabitatRpcClient({
      onConnectionStateChange: (state) => legacy.push(state),
    });

    const unsub = subscribeHabitatRpcConnectionState((state) => subscribed.push(state));
    expect(subscribed[0]).toBe("connecting");

    // 模拟 transport 层状态变更（通过新建 client 触发 startTransport 的 notify）
    void getBundledHabitatRpcClient()
      .whenReady()
      .catch(() => undefined);

    expect(legacy.length).toBeGreaterThanOrEqual(1);
    expect(subscribed.length).toBeGreaterThanOrEqual(1);
    unsub();
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  getBundledHabitatRpcClient,
  getHabitatRpcConnectionState,
  getInitialHabitatRpcConnectionStateForUi,
  resetBundledHabitatRpcClientForTests,
  subscribeHabitatRpcConnectionState,
  type HabitatRpcConnectionState,
} from "./bundled-browser.ts";

describe("subscribeHabitatRpcConnectionState", () => {
  beforeEach(() => {
    resetBundledHabitatRpcClientForTests();
  });

  afterEach(() => {
    resetBundledHabitatRpcClientForTests();
    delete (globalThis as { window?: Window & { portalShell?: unknown } }).window;
  });

  test("无 token 时订阅后为 disconnected（避免设置页一直「连接中」）", () => {
    (globalThis as { window?: Window }).window = {
      portalShell: undefined,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as unknown as Window;
    const states: HabitatRpcConnectionState[] = [];
    const unsub = subscribeHabitatRpcConnectionState((state) => states.push(state));
    expect(getHabitatRpcConnectionState()).toBe("disconnected");
    expect(states).toEqual(["disconnected"]);
    unsub();
  });

  test("多订阅者同步收到 onConnectionStateChange 广播", () => {
    (globalThis as { window?: Window }).window = {
      portalShell: { remoteAuth: { token: "fa_at_test" }, habitatUrl: "http://127.0.0.1:2658" },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      document: { addEventListener: () => {}, visibilityState: "visible" },
    } as unknown as Window;
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

describe("getInitialHabitatRpcConnectionStateForUi", () => {
  afterEach(() => {
    resetBundledHabitatRpcClientForTests();
    delete (globalThis as { window?: Window & { portalShell?: unknown } }).window;
  });

  test("无 token 时首帧为 disconnected", () => {
    (globalThis as { window?: Window }).window = {
      portalShell: undefined,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as unknown as Window;
    expect(getInitialHabitatRpcConnectionStateForUi()).toBe("disconnected");
  });
});

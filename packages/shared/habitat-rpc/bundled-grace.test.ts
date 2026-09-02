import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { HABITAT_RPC_DISCONNECT_GRACE_MS } from "./constants.ts";
import * as transport from "./transport.ts";

describe("bundled-browser disconnect grace", () => {
  beforeEach(() => {
    delete (globalThis as { window?: Window & { portalShell?: unknown } }).window;
  });

  afterEach(async () => {
    delete (globalThis as { window?: Window & { portalShell?: unknown } }).window;
    const bundled = await import("./bundled-browser.ts");
    bundled.resetBundledHabitatRpcClientForTests();
  });

  test("快速连续 onDisconnected 不重置 grace，超时后变为 disconnected", async () => {
    let onDisconnected: (() => void) | undefined;

    const spy = spyOn(transport, "runHabitatRpcTransport").mockImplementation((opts) => {
      onDisconnected = opts.onDisconnected;
      return {
        getClient: () => null,
        whenConnected: () => new Promise(() => {}),
        getLastInboundAt: () => null,
        stop: () => {},
      };
    });

    const bundled = await import("./bundled-browser.ts");
    bundled.resetBundledHabitatRpcClientForTests();

    (globalThis as { window?: Window }).window = {
      portalShell: { remoteAuth: { token: "fa_at_test" }, habitatUrl: "http://127.0.0.1:2658" },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      document: { addEventListener: () => {}, visibilityState: "visible" },
    } as unknown as Window;

    void bundled
      .getBundledHabitatRpcClient()
      .whenReady()
      .catch(() => undefined);
    expect(onDisconnected).toBeDefined();
    onDisconnected?.();
    onDisconnected?.();

    expect(bundled.getHabitatRpcConnectionState()).toBe("connecting");

    spy.mockRestore();

    await new Promise<void>((resolve) => {
      setTimeout(resolve, HABITAT_RPC_DISCONNECT_GRACE_MS + 50);
    });
    expect(bundled.getHabitatRpcConnectionState()).toBe("disconnected");

    bundled.resetBundledHabitatRpcClientForTests();
  }, 20_000);
});

import { afterEach, describe, expect, it } from "bun:test";

import { applyWebUiConfig } from "./shared.ts";

describe("applyWebUiConfig", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("empty habitat_url → page origin + sameOrigin", () => {
    (globalThis as { window: Window }).window = {
      location: { origin: "http://127.0.0.1:5000" },
    } as unknown as Window;

    const result = applyWebUiConfig({
      app_id: "chat",
      habitat_url: "",
      habitat_ws_url: "",
      remote_auth_token: "fa_at_devtoken_xx",
    });
    expect(result.habitatUrl).toBe("http://127.0.0.1:5000");
    expect(result.sameOrigin).toBe(true);
    expect(result.remoteAuthToken).toBe("fa_at_devtoken_xx");
  });

  it("explicit remote habitat_url → not sameOrigin", () => {
    (globalThis as { window: Window }).window = {
      location: { origin: "http://127.0.0.1:5000" },
    } as unknown as Window;

    const result = applyWebUiConfig({
      app_id: "chat",
      habitat_url: "http://127.0.0.1:2658",
      habitat_ws_url: "ws://127.0.0.1:2658/rpc/v1",
    });
    expect(result.habitatUrl).toBe("http://127.0.0.1:2658");
    expect(result.sameOrigin).toBe(false);
  });
});

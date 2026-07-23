import { afterEach, describe, expect, it } from "bun:test";

import { applyWebUiConfig } from "./shared.ts";

describe("shell-bridge shared", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("applyWebUiConfig：同源 hub_url 用页面 origin", () => {
    (globalThis as { window: Window }).window = {
      location: { origin: "http://127.0.0.1:5000" },
    } as unknown as Window;

    const cfg = applyWebUiConfig({
      habitat_url: "http://127.0.0.1:5000",
    } as Parameters<typeof applyWebUiConfig>[0]);
    expect(cfg.sameOrigin).toBe(true);
    expect(cfg.habitatUrl).toBe("http://127.0.0.1:5000");
  });

  it("applyWebUiConfig：跨 origin hub 保留地址", () => {
    (globalThis as { window: Window }).window = {
      location: { origin: "http://127.0.0.1:5000" },
    } as unknown as Window;

    const cfg = applyWebUiConfig({
      habitat_url: "http://10.0.0.2:2658",
    } as Parameters<typeof applyWebUiConfig>[0]);
    expect(cfg.sameOrigin).toBe(false);
    expect(cfg.habitatUrl).toBe("http://10.0.0.2:2658");
  });
});

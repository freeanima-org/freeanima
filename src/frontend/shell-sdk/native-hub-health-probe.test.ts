import { describe, expect, test } from "bun:test";

describe("native-hub-health-probe", () => {
  test("shouldProbeHubHealthViaCapacitorHttp is false for same-origin hub", async () => {
    const prev = globalThis.window;
    (globalThis as { window: Window }).window = {
      location: { origin: "http://10.244.0.244:2658" },
      satelliteShell: { isNativeShell: true },
      navigator: { userAgent: "Android" },
      Capacitor: { isNativePlatform: () => true },
    } as unknown as Window;
    try {
      const { shouldProbeHubHealthViaCapacitorHttp } = await import("./native-hub-health-probe.ts");
      expect(await shouldProbeHubHealthViaCapacitorHttp("http://10.244.0.244:2658")).toBe(false);
    } finally {
      (globalThis as { window?: Window }).window = prev;
    }
  });
});

import { describe, expect, test } from "bun:test";

describe("native-habitat-health-probe", () => {
  test("shouldProbeHabitatHealthViaNativeHttp：同源 Habitat 为 false", async () => {
    const prev = globalThis.window;
    (globalThis as { window: Window }).window = {
      location: { origin: "http://10.244.0.244:2658" },
      portalShell: { isTauri: true, isNativeShell: true },
    } as unknown as Window;
    try {
      const { shouldProbeHabitatHealthViaNativeHttp } =
        await import("./native-habitat-health-probe.ts");
      expect(await shouldProbeHabitatHealthViaNativeHttp("http://10.244.0.244:2658")).toBe(false);
    } finally {
      (globalThis as { window?: Window }).window = prev;
    }
  });

  test("shouldProbeHabitatHealthViaNativeHttp：非 Tauri 为 false", async () => {
    const prev = globalThis.window;
    (globalThis as { window: Window }).window = {
      location: { origin: "http://localhost:5000" },
      portalShell: { isNativeShell: false },
    } as unknown as Window;
    try {
      const { shouldProbeHabitatHealthViaNativeHttp } =
        await import("./native-habitat-health-probe.ts");
      expect(await shouldProbeHabitatHealthViaNativeHttp("http://10.244.0.244:2658")).toBe(false);
    } finally {
      (globalThis as { window?: Window }).window = prev;
    }
  });
});

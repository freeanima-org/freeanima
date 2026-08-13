import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const call = mock((_method: string, _payload?: unknown) => Promise.resolve({}));

const habitatClientActual = await import("@freeanima/shared/habitat-client/bundled-browser.ts");

mock.module("@freeanima/shared/habitat-client/bundled-browser.ts", () => ({
  ...habitatClientActual,
  getBundledHabitatClient: () => ({ call }),
  resetBundledHabitatClientForTests: () => undefined,
}));

afterAll(() => {
  mock.restore();
});

const {
  fetchHabitatConfig,
  fetchHabitatConfigSection,
  patchHabitatConfigSection,
  testHabitatConfigConnection,
} = await import("./habitat-config-api.ts");

describe("habitat-config-api", () => {
  beforeEach(() => {
    call.mockClear();
    call.mockResolvedValue({});
  });

  test("fetchHabitatConfig 走 habitatRpc.call config.get", async () => {
    call.mockResolvedValue({ compression: { enabled: true } });
    const result = await fetchHabitatConfig();
    expect(call).toHaveBeenCalledWith("config.get", {});
    expect(result).toEqual({ compression: { enabled: true } });
  });

  test("fetchHabitatConfigSection 走 habitatRpc.call config.getSection", async () => {
    call.mockResolvedValue({ enabled: true, max_rounds: 50 });
    const result = await fetchHabitatConfigSection("compression");
    expect(call).toHaveBeenCalledWith("config.getSection", { section: "compression" });
    expect(result).toEqual({ enabled: true, max_rounds: 50 });
  });

  test("patchHabitatConfigSection 走 habitatRpc.call config.patchSection", async () => {
    await patchHabitatConfigSection("compression", { enabled: false });
    expect(call).toHaveBeenCalledWith("config.patchSection", {
      section: "compression",
      patch: { enabled: false },
    });
  });

  test("testHabitatConfigConnection 走 habitatRpc.call config.testConnection", async () => {
    call.mockResolvedValue({ ok: true, message: "ok" });
    await testHabitatConfigConnection({ service: "embedding" });
    expect(call).toHaveBeenCalledWith("config.testConnection", { service: "embedding" });
  });
});

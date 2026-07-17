import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const call = mock((_method: string, _payload?: unknown) => Promise.resolve({}));

const hubClientActual = await import("@freeanima/shared/hub-client");

mock.module("@freeanima/shared/hub-client", () => ({
  ...hubClientActual,
  getBundledHubClient: () => ({ call }),
  resetBundledHubClientForTests: () => undefined,
}));

mock.module("./hub-api-fetch.ts", () => ({
  resolveHubApiFetch: () => globalThis.fetch,
  resolveBinarySafeHubFetch: () => globalThis.fetch,
  resolveHubApiUrl: (path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `http://127.0.0.1:2658${normalized}`;
  },
  readStoredHubUrl: () => null,
}));

afterAll(() => {
  mock.restore();
});

const { fetchHubConfig, fetchHubConfigSection, patchHubConfigSection, testHubConfigConnection } =
  await import("./hub-config-api.ts");

describe("hub-config-api", () => {
  beforeEach(() => {
    call.mockClear();
    call.mockResolvedValue({});
  });

  test("fetchHubConfig 走 hub.call config.get", async () => {
    call.mockResolvedValue({ compression: { enabled: true } });
    const result = await fetchHubConfig();
    expect(call).toHaveBeenCalledWith("config.get", {});
    expect(result).toEqual({ compression: { enabled: true } });
  });

  test("fetchHubConfigSection 走 hub.call config.getSection", async () => {
    call.mockResolvedValue({ enabled: true, max_rounds: 50 });
    const result = await fetchHubConfigSection("compression");
    expect(call).toHaveBeenCalledWith("config.getSection", { section: "compression" });
    expect(result).toEqual({ enabled: true, max_rounds: 50 });
  });

  test("patchHubConfigSection 走 hub.call config.patchSection", async () => {
    await patchHubConfigSection("compression", { enabled: false });
    expect(call).toHaveBeenCalledWith("config.patchSection", {
      section: "compression",
      patch: { enabled: false },
    });
  });

  test("testHubConfigConnection 走 hub.call config.testConnection", async () => {
    call.mockResolvedValue({ ok: true, message: "ok" });
    await testHubConfigConnection({ service: "embedding" });
    expect(call).toHaveBeenCalledWith("config.testConnection", { service: "embedding" });
  });
});

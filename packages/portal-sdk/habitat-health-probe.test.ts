import { afterAll, afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import {
  formatHabitatHealthProbeFetchError,
  habitatHealthFailureReason,
  isHabitatHealthConnected,
  isHabitatHealthDnsOrHostsError,
  probeHabitatHealthUrl,
} from "./habitat-health-probe.ts";

const nativeProbeOriginal = await import("./native-habitat-health-probe.ts");
const realShouldProbeHabitatHealthViaNativeHttp =
  nativeProbeOriginal.shouldProbeHabitatHealthViaNativeHttp;
const realProbeHabitatHealthViaNativeHttp = nativeProbeOriginal.probeHabitatHealthViaNativeHttp;

function restoreNativeHabitatHealthProbeModule(): void {
  // Bun mock.module 会写穿原模块导出；必须还原到 mock 前捕获的函数引用
  mock.module("./native-habitat-health-probe.ts", () => ({
    shouldProbeHabitatHealthViaNativeHttp: realShouldProbeHabitatHealthViaNativeHttp,
    probeHabitatHealthViaNativeHttp: realProbeHabitatHealthViaNativeHttp,
  }));
}

describe("habitat-health-probe", () => {
  afterEach(() => {
    delete (globalThis as { portalShell?: unknown }).portalShell;
    mock.restore();
    restoreNativeHabitatHealthProbeModule();
  });

  afterAll(() => {
    restoreNativeHabitatHealthProbeModule();
  });

  test("isHabitatHealthConnected", () => {
    expect(isHabitatHealthConnected({ status: "ok", authed: true })).toBe(true);
    expect(isHabitatHealthConnected({ status: "ok" })).toBe(true);
    expect(isHabitatHealthConnected({ status: "ok", authed: false })).toBe(false);
    expect(isHabitatHealthConnected({ status: "degraded", authed: true })).toBe(false);
  });

  test("habitatHealthFailureReason", () => {
    expect(habitatHealthFailureReason({ status: "ok", authed: true })).toBeNull();
    expect(habitatHealthFailureReason({ status: "ok", authed: false })).toBe(
      "栖息地可达，但认证失败：请检查 Service API Token",
    );
    expect(habitatHealthFailureReason({ status: "down" })).toBe("栖息地可达，但服务状态异常");
  });

  test("isHabitatHealthDnsOrHostsError", () => {
    expect(isHabitatHealthDnsOrHostsError(new Error("无法解析主机名 `x`：…"))).toBe(true);
    expect(isHabitatHealthDnsOrHostsError(new Error("无法解析主机名 `x`（无地址）"))).toBe(true);
    expect(
      isHabitatHealthDnsOrHostsError(
        new Error("网络错误（TLS 证书未被壳原生 HTTP 信任）：UnknownIssuer"),
      ),
    ).toBe(false);
  });

  test("formatHabitatHealthProbeFetchError：桌面壳 HTTPS 提示安装 mkcert CA", () => {
    (
      globalThis as {
        portalShell?: { isTauri: boolean; primaryInput: "pointer" };
      }
    ).portalShell = {
      isTauri: true,
      primaryInput: "pointer",
    };
    expect(
      formatHabitatHealthProbeFetchError(new TypeError("fetch failed"), "https://habitat.lan:2659"),
    ).toContain("桌面壳 HTTPS");
  });

  test("formatHabitatHealthProbeFetchError：移动壳 HTTPS 提示安装 CA", () => {
    (
      globalThis as {
        portalShell?: { isTauri: boolean; isNativeShell: boolean; primaryInput: "touch" };
      }
    ).portalShell = {
      isTauri: true,
      isNativeShell: true,
      primaryInput: "touch",
    };
    expect(
      formatHabitatHealthProbeFetchError(new TypeError("fetch failed"), "https://habitat.lan:2659"),
    ).toContain("手机");
  });

  test("probeHabitatHealthUrl：原生 TLS 失败时回退 WebView fetch", async () => {
    (globalThis as { portalShell?: { isTauri: boolean } }).portalShell = { isTauri: true };
    mock.module("./native-habitat-health-probe.ts", () => ({
      shouldProbeHabitatHealthViaNativeHttp: async () => true,
      probeHabitatHealthViaNativeHttp: async () => {
        throw new Error("网络错误（TLS 证书未被壳原生 HTTP 信任）：UnknownIssuer");
      },
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      Response.json({ status: "ok", authed: true })) as unknown as typeof fetch;
    try {
      const body = await probeHabitatHealthUrl("https://habitat.lan:2659", { token: "t" });
      expect(body).toEqual({ status: "ok", authed: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("probeHabitatHealthUrl：原生 DNS 失败不回退 WebView", async () => {
    (globalThis as { portalShell?: { isTauri: boolean } }).portalShell = { isTauri: true };
    mock.module("./native-habitat-health-probe.ts", () => ({
      shouldProbeHabitatHealthViaNativeHttp: async () => true,
      probeHabitatHealthViaNativeHttp: async () => {
        throw new Error("无法解析主机名 `habitat.lan`：Name or service not known");
      },
    }));
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return Response.json({ status: "ok", authed: true });
    }) as unknown as typeof fetch;
    try {
      await expect(probeHabitatHealthUrl("https://habitat.lan:2659")).rejects.toThrow(
        "无法解析主机名",
      );
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("testHabitatHealthConnection 有 token 时 Web 也探测 WebSocket", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      Response.json({ status: "ok", authed: true })) as unknown as typeof fetch;

    const healthProbe = await import("./habitat-health-probe.ts");
    const wsSpy = spyOn(healthProbe, "probeHabitatRpcWebSocket").mockImplementation(async () => {});

    try {
      await healthProbe.testHabitatHealthConnection("https://habitat.example.com", "fa_at_test");
      expect(wsSpy.mock.calls.length).toBe(1);
    } finally {
      wsSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });
});

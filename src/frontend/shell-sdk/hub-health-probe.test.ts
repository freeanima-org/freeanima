import { afterEach, describe, expect, test } from "bun:test";
import {
  formatHubHealthProbeFetchError,
  hubHealthFailureReason,
  isHubHealthConnected,
} from "./hub-health-probe.ts";

describe("hub-health-probe", () => {
  afterEach(() => {
    delete (globalThis as { satelliteShell?: unknown }).satelliteShell;
  });

  test("isHubHealthConnected", () => {
    expect(isHubHealthConnected({ status: "ok", authed: true })).toBe(true);
    expect(isHubHealthConnected({ status: "ok" })).toBe(true);
    expect(isHubHealthConnected({ status: "ok", authed: false })).toBe(false);
    expect(isHubHealthConnected({ status: "degraded", authed: true })).toBe(false);
  });

  test("hubHealthFailureReason", () => {
    expect(hubHealthFailureReason({ status: "ok", authed: true })).toBeNull();
    expect(hubHealthFailureReason({ status: "ok", authed: false })).toBe(
      "Hub 可达，但认证失败：请检查 Service API Token",
    );
    expect(hubHealthFailureReason({ status: "down" })).toBe("Hub 可达，但服务状态异常");
  });

  test("formatHubHealthProbeFetchError：桌面壳 HTTPS 提示安装 mkcert CA", () => {
    (globalThis as { satelliteShell?: { isElectron: boolean } }).satelliteShell = {
      isElectron: true,
    };
    expect(
      formatHubHealthProbeFetchError(new TypeError("fetch failed"), "https://hub.lan:2659"),
    ).toContain("桌面壳 HTTPS");
  });

  test("formatHubHealthProbeFetchError：移动壳 HTTPS 提示安装 CA", () => {
    (globalThis as { satelliteShell?: { isNativeShell: boolean } }).satelliteShell = {
      isNativeShell: true,
    };
    expect(
      formatHubHealthProbeFetchError(new TypeError("fetch failed"), "https://hub.lan:2659"),
    ).toContain("手机");
  });
});

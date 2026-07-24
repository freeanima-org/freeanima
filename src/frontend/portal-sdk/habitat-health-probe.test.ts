import { afterEach, describe, expect, test } from "bun:test";
import {
  formatHabitatHealthProbeFetchError,
  habitatHealthFailureReason,
  isHabitatHealthConnected,
} from "./habitat-health-probe.ts";

describe("habitat-health-probe", () => {
  afterEach(() => {
    delete (globalThis as { portalShell?: unknown }).portalShell;
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
});

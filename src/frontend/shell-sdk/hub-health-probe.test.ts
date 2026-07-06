import { describe, expect, test } from "bun:test";
import { hubHealthFailureReason, isHubHealthConnected } from "./hub-health-probe.ts";

describe("hub-health-probe", () => {
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
});

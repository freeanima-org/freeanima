import { describe, expect, test } from "bun:test";

import {
  buildOriginIdentityProbe,
  buildPlatformInfo,
  isCronPlatformInfo,
  isSapPlatformString,
  parseSapPlatformString,
  splitPlatformInfo,
  stripOriginRoutingMeta,
} from "./platform-info.ts";

describe("platform-info", () => {
  test("parseSapPlatformString accepts sap:app:instance", () => {
    expect(parseSapPlatformString("sap:chat:default")).toEqual({
      app_slug: "chat",
      instance_id_norm: "default",
    });
    expect(parseSapPlatformString("discord:x")).toBeNull();
  });

  test("buildPlatformInfo fills SAP satellite fields", () => {
    const info = buildPlatformInfo("sap:chat:inst-1", {});
    expect(info).toMatchObject({
      platform: "sap:chat:inst-1",
      satellite_app_id: "chat",
      satellite_instance_id: "inst-1",
    });
  });

  test("buildPlatformInfo applies discord defaults", () => {
    const info = buildPlatformInfo("discord", {});
    expect(info).toMatchObject({ platform: "discord", channel_id: "nothing" });
  });

  test("stripOriginRoutingMeta removes routing keys", () => {
    expect(stripOriginRoutingMeta({ origin_active: true, ended_at: "x", channel_id: "1" })).toEqual(
      {
        channel_id: "1",
      },
    );
  });

  test("buildOriginIdentityProbe uses stripped extra", () => {
    const probe = buildOriginIdentityProbe("discord", {
      channel_id: "ch1",
      origin_active: false,
    });
    expect(probe).toMatchObject({ platform: "discord", channel_id: "ch1" });
    expect(probe).not.toHaveProperty("origin_active");
  });

  test("splitPlatformInfo round-trips platform field", () => {
    const info = buildPlatformInfo("cron", {});
    expect(splitPlatformInfo(info)).toEqual({ platform: "cron" });
  });

  test("isCronPlatformInfo detects cron", () => {
    expect(isCronPlatformInfo(buildPlatformInfo("cron", {}))).toBe(true);
    expect(isCronPlatformInfo(buildPlatformInfo("sap:chat:x", {}))).toBe(false);
  });

  test("isSapPlatformString", () => {
    expect(isSapPlatformString("sap:chat:default")).toBe(true);
    expect(isSapPlatformString("sap:chat")).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";

import {
  buildOriginIdentityProbe,
  buildPlatformInfo,
  isCronPlatformInfo,
  isRemotePlatformString,
  parseRemotePlatformString,
  splitPlatformInfo,
  stripOriginRoutingMeta,
} from "./platform-info.ts";

describe("platform-info", () => {
  test("parseRemotePlatformString accepts remote:app:instance", () => {
    expect(parseRemotePlatformString("remote:chat:default")).toEqual({
      app_slug: "chat",
      instance_id_norm: "default",
    });
    expect(parseRemotePlatformString("sap:chat:default")).toBeNull();
    expect(parseRemotePlatformString("discord:x")).toBeNull();
  });

  test("buildPlatformInfo fills outpost fields", () => {
    const info = buildPlatformInfo("remote:chat:inst-1", {});
    expect(info).toMatchObject({
      platform: "remote:chat:inst-1",
      outpost_app_id: "chat",
      outpost_instance_id: "inst-1",
    });
  });

  test("buildPlatformInfo applies discord defaults", () => {
    const info = buildPlatformInfo("discord", {});
    expect(info).toMatchObject({ platform: "discord", channel_id: "nothing" });
  });

  test("buildPlatformInfo accepts flat chat platform", () => {
    expect(buildPlatformInfo("chat", {})).toEqual({ platform: "chat" });
  });

  test("buildPlatformInfo preserves extra fields for chat platform", () => {
    const info = buildPlatformInfo("chat", { capability_mask: { presets: ["sleep"] } });
    expect(info).toMatchObject({ platform: "chat", capability_mask: { presets: ["sleep"] } });
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
    expect(isCronPlatformInfo(buildPlatformInfo("remote:chat:x", {}))).toBe(false);
  });

  test("isRemotePlatformString", () => {
    expect(isRemotePlatformString("remote:chat:default")).toBe(true);
    expect(isRemotePlatformString("remote:chat")).toBe(false);
  });
});

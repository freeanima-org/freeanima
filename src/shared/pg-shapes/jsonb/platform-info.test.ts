import { describe, expect, test } from "bun:test";

import {
  buildOriginIdentityProbe,
  buildPlatformInfo,
  canonicalizeConversationPlatform,
  isCronPlatformInfo,
  isRemotePlatformString,
  parseRemotePlatformString,
  platformInfoSchema,
  splitPlatformInfo,
  stripOriginRoutingMeta,
} from "./platform-info.ts";

describe("platform-info", () => {
  test("parseRemotePlatformString accepts remote:app:instance only", () => {
    expect(parseRemotePlatformString("remote:chat:default")).toEqual({
      app_slug: "chat",
      instance_id_norm: "default",
    });
    expect(parseRemotePlatformString("sap:chat:default")).toBeNull();
    expect(parseRemotePlatformString("discord:x")).toBeNull();
  });

  test("buildPlatformInfo rejects remote: and sap: platforms", () => {
    expect(buildPlatformInfo("remote:chat:inst-1", {})).toBeNull();
    expect(buildPlatformInfo("sap:companion:k7m", {})).toBeNull();
  });

  test("platformInfoSchema rejects remote: / sap: rows", () => {
    expect(() =>
      platformInfoSchema.parse({
        platform: "remote:companion:abc",
        outpost_app_id: "companion",
      }),
    ).toThrow();
    expect(() =>
      platformInfoSchema.parse({
        platform: "sap:companion:abc",
      }),
    ).toThrow();
  });

  test("buildPlatformInfo applies discord defaults", () => {
    const info = buildPlatformInfo("discord", {});
    expect(info).toMatchObject({ platform: "discord", channel_id: "nothing" });
  });

  test("buildPlatformInfo accepts flat chat platform", () => {
    expect(buildPlatformInfo("chat", {})).toEqual({ platform: "chat" });
  });

  test("buildPlatformInfo preserves extra fields for chat platform", () => {
    const info = buildPlatformInfo("chat", { note: "x" });
    expect(info).toMatchObject({ platform: "chat", note: "x" });
  });

  test("buildPlatformInfo accepts flat coding / companion with outpost fields", () => {
    expect(
      buildPlatformInfo("coding", {
        outpost_app_id: "coding",
        outpost_instance_id: "inst-1",
        workspace_root: "/repo",
        project_world_id: 99,
      }),
    ).toMatchObject({
      platform: "coding",
      outpost_app_id: "coding",
      outpost_instance_id: "inst-1",
      workspace_root: "/repo",
      project_world_id: 99,
    });
    expect(
      buildPlatformInfo("companion", {
        outpost_app_id: "companion",
        outpost_instance_id: "k7m",
      }),
    ).toMatchObject({
      platform: "companion",
      outpost_app_id: "companion",
      outpost_instance_id: "k7m",
    });
  });

  test("buildPlatformInfo accepts project_world_id on chat", () => {
    expect(buildPlatformInfo("chat", { project_world_id: 12 })).toMatchObject({
      platform: "chat",
      project_world_id: 12,
    });
  });

  test("buildPlatformInfo returns null for unknown / empty / cron", () => {
    expect(buildPlatformInfo(undefined)).toBeNull();
    expect(buildPlatformInfo("")).toBeNull();
    expect(buildPlatformInfo("cron")).toBeNull();
    expect(buildPlatformInfo("test")).toBeNull();
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

  test("splitPlatformInfo round-trips coding platform", () => {
    const info = buildPlatformInfo("coding", { outpost_instance_id: "x" });
    expect(splitPlatformInfo(info)).toEqual({
      platform: "coding",
      platform_extra: { outpost_instance_id: "x" },
    });
  });

  test("isCronPlatformInfo detects legacy cron objects", () => {
    expect(isCronPlatformInfo({ platform: "cron" })).toBe(true);
    expect(isCronPlatformInfo(buildPlatformInfo("coding", {}))).toBe(false);
    expect(isCronPlatformInfo(null)).toBe(false);
  });

  test("isRemotePlatformString", () => {
    expect(isRemotePlatformString("remote:chat:default")).toBe(true);
    expect(isRemotePlatformString("sap:companion:k7m")).toBe(false);
    expect(isRemotePlatformString("remote:chat")).toBe(false);
    expect(isRemotePlatformString("coding")).toBe(false);
  });

  test("canonicalizeConversationPlatform soft-defaults", () => {
    expect(canonicalizeConversationPlatform("chat")).toBe("chat");
    expect(canonicalizeConversationPlatform("coding")).toBe("coding");
    expect(canonicalizeConversationPlatform("companion")).toBe("companion");
    expect(canonicalizeConversationPlatform("weixin")).toBe("weixin");
    expect(canonicalizeConversationPlatform("discord")).toBe("discord");
    expect(canonicalizeConversationPlatform(undefined)).toBe("chat");
    expect(canonicalizeConversationPlatform(null)).toBe("chat");
    expect(canonicalizeConversationPlatform("")).toBe("chat");
    expect(canonicalizeConversationPlatform("remote:coding:abc")).toBe("chat");
    expect(canonicalizeConversationPlatform("cron")).toBe("chat");
    expect(canonicalizeConversationPlatform("test")).toBe("chat");
  });
});

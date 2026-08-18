import { describe, expect, test } from "bun:test";

import { resolveConnectivityNotice, shellWritesDisabled } from "./connectivity-notice.ts";

describe("resolveConnectivityNotice", () => {
  test("在线且 Habitat 已连接时不展示", () => {
    expect(
      resolveConnectivityNotice({ networkOnline: true, habitatConnection: "connected" }),
    ).toBeNull();
  });

  test("浏览器离线优先", () => {
    expect(
      resolveConnectivityNotice({ networkOnline: false, habitatConnection: "connected" }),
    ).toEqual({ variant: "warning", kind: "offline" });
  });

  test("Habitat 连接中", () => {
    expect(
      resolveConnectivityNotice({ networkOnline: true, habitatConnection: "connecting" }),
    ).toEqual({ variant: "info", kind: "habitat-connecting" });
  });

  test("Habitat 已断开", () => {
    expect(
      resolveConnectivityNotice({ networkOnline: true, habitatConnection: "disconnected" }),
    ).toEqual({ variant: "warning", kind: "habitat-disconnected" });
  });

  test("弱网本地优先（Habitat 仍 connected）", () => {
    expect(
      resolveConnectivityNotice({
        networkOnline: true,
        habitatConnection: "connected",
        localPrefer: true,
      }),
    ).toEqual({ variant: "warning", kind: "local-prefer" });
  });

  test("真断网优先于本地优先", () => {
    expect(
      resolveConnectivityNotice({
        networkOnline: false,
        habitatConnection: "connected",
        localPrefer: true,
      }),
    ).toEqual({ variant: "warning", kind: "offline" });
  });
});

describe("shellWritesDisabled", () => {
  test("在线且 Habitat 已连接时可写", () => {
    expect(shellWritesDisabled({ networkOnline: true, habitatConnection: "connected" })).toBe(
      false,
    );
  });

  test("离线或 Habitat 未连接时禁用写操作", () => {
    expect(shellWritesDisabled({ networkOnline: false, habitatConnection: "connected" })).toBe(
      true,
    );
    expect(shellWritesDisabled({ networkOnline: true, habitatConnection: "connecting" })).toBe(
      true,
    );
    expect(shellWritesDisabled({ networkOnline: true, habitatConnection: "disconnected" })).toBe(
      true,
    );
  });
});

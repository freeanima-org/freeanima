import { describe, expect, test } from "bun:test";

import { resolveConnectivityNotice, shellWritesDisabled } from "./connectivity-notice.ts";

describe("resolveConnectivityNotice", () => {
  test("在线且 Hub 已连接时不展示", () => {
    expect(
      resolveConnectivityNotice({ networkOnline: true, hubConnection: "connected" }),
    ).toBeNull();
  });

  test("浏览器离线优先", () => {
    expect(resolveConnectivityNotice({ networkOnline: false, hubConnection: "connected" })).toEqual(
      { variant: "warning", kind: "offline" },
    );
  });

  test("Hub 连接中", () => {
    expect(resolveConnectivityNotice({ networkOnline: true, hubConnection: "connecting" })).toEqual(
      { variant: "info", kind: "hub-connecting" },
    );
  });

  test("Hub 已断开", () => {
    expect(
      resolveConnectivityNotice({ networkOnline: true, hubConnection: "disconnected" }),
    ).toEqual({ variant: "warning", kind: "hub-disconnected" });
  });
});

describe("shellWritesDisabled", () => {
  test("在线且 Hub 已连接时可写", () => {
    expect(shellWritesDisabled({ networkOnline: true, hubConnection: "connected" })).toBe(false);
  });

  test("离线或 Hub 未连接时禁用写操作", () => {
    expect(shellWritesDisabled({ networkOnline: false, hubConnection: "connected" })).toBe(true);
    expect(shellWritesDisabled({ networkOnline: true, hubConnection: "connecting" })).toBe(true);
    expect(shellWritesDisabled({ networkOnline: true, hubConnection: "disconnected" })).toBe(true);
  });
});

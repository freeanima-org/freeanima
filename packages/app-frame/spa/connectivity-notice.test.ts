import { describe, expect, test } from "bun:test";

import { resolveConnectivityNotice } from "./connectivity-notice.ts";

describe("resolveConnectivityNotice", () => {
  test("connecting 显示连接中而非断开", () => {
    expect(
      resolveConnectivityNotice({
        networkOnline: true,
        habitatConnection: "connecting",
      }),
    ).toEqual({ variant: "info", kind: "habitat-connecting" });
  });

  test("长时间未恢复才标 disconnected", () => {
    expect(
      resolveConnectivityNotice({
        networkOnline: true,
        habitatConnection: "disconnected",
      }),
    ).toEqual({ variant: "warning", kind: "habitat-disconnected" });
  });
});

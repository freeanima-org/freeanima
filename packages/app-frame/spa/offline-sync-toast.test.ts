import { describe, expect, it } from "bun:test";

import {
  buildOfflineSyncSummaryMessage,
  shouldShowOfflineSyncToast,
} from "./offline-sync-toast.ts";

describe("shouldShowOfflineSyncToast", () => {
  it("connected + 纯 pending 不展示", () => {
    expect(shouldShowOfflineSyncToast({ pending: 1, failed: 0, stale: 0 }, "connected")).toBe(
      false,
    );
  });

  it("未 connected + pending 展示", () => {
    expect(shouldShowOfflineSyncToast({ pending: 2, failed: 0, stale: 0 }, "disconnected")).toBe(
      true,
    );
    expect(shouldShowOfflineSyncToast({ pending: 1, failed: 0, stale: 0 }, "connecting")).toBe(
      true,
    );
  });

  it("failed / stale 任意连接状态都展示", () => {
    expect(shouldShowOfflineSyncToast({ pending: 0, failed: 1, stale: 0 }, "connected")).toBe(true);
    expect(shouldShowOfflineSyncToast({ pending: 0, failed: 0, stale: 1 }, "connected")).toBe(true);
  });
});

describe("buildOfflineSyncSummaryMessage", () => {
  const format = {
    pending: (n: number) => `${n} pending`,
    failed: (n: number) => `${n} failed`,
    stale: (n: number) => `${n} stale`,
  };

  it("connected 时不拼 pending", () => {
    expect(
      buildOfflineSyncSummaryMessage({ pending: 1, failed: 1, stale: 0 }, "connected", format),
    ).toBe("1 failed");
  });

  it("离线时拼 pending", () => {
    expect(
      buildOfflineSyncSummaryMessage({ pending: 1, failed: 0, stale: 0 }, "disconnected", format),
    ).toBe("1 pending");
  });
});

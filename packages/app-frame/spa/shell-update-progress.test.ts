import { describe, expect, it } from "bun:test";

import { formatApplyingMessage, formatProgressBytes } from "./shell-update-progress.ts";

describe("shell-update-progress", () => {
  it("formatProgressBytes covers units", () => {
    expect(formatProgressBytes(500)).toBe("500 B");
    expect(formatProgressBytes(2048)).toBe("2.0 KB");
    expect(formatProgressBytes(2 * 1024 ** 2)).toBe("2.0 MB");
  });

  it("formatApplyingMessage covers phases", () => {
    expect(formatApplyingMessage(null)).toBe("正在下载并安装…");
    expect(formatApplyingMessage({ received: 50, total: 100, phase: "downloading" })).toBe(
      "下载中… 50%",
    );
    expect(formatApplyingMessage({ received: 1500, total: null, phase: "downloading" })).toBe(
      "下载中… 1.5 KB",
    );
    expect(formatApplyingMessage({ received: 100, total: 100, phase: "installing" })).toBe(
      "正在安装…",
    );
  });
});

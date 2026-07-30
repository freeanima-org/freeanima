import { describe, expect, test } from "bun:test";
import { formatVrmLoadError } from "./vrm-load-error.ts";

describe("formatVrmLoadError", () => {
  test("maps undefined property TypeError", () => {
    expect(
      formatVrmLoadError(new Error("Cannot read properties of undefined (reading 'undefined')")),
    ).toContain("合法 VRM");
  });

  test("keeps download errors", () => {
    expect(formatVrmLoadError(new Error("模型下载失败 (HTTP 404)"))).toBe(
      "模型下载失败 (HTTP 404)",
    );
  });
});

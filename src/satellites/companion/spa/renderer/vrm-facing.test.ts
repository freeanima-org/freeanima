import { describe, expect, test } from "bun:test";
import { resolveFacingOffsetY } from "./vrm-facing.ts";

describe("resolveFacingOffsetY", () => {
  test("VRM 0.x 需 180° 偏移", () => {
    expect(resolveFacingOffsetY("0")).toBe(Math.PI);
  });

  test("VRM 1.0 无需额外偏移", () => {
    expect(resolveFacingOffsetY("1")).toBe(0);
  });

  test("未知版本默认按 1.0 处理", () => {
    expect(resolveFacingOffsetY(undefined)).toBe(0);
  });
});

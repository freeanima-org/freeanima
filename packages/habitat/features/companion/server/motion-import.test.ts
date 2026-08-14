import { describe, expect, test } from "bun:test";
import { sanitizeMotionBaseName } from "./motion-import.ts";

describe("sanitizeMotionBaseName", () => {
  test("空格替换为下划线", () => {
    expect(sanitizeMotionBaseName("my motion.vrma")).toBe("my_motion");
    expect(sanitizeMotionBaseName("hello world (1).vrma")).toBe("hello_world_(1)");
  });

  test("非法字符替换为下划线", () => {
    expect(sanitizeMotionBaseName("a@b#c.vrma")).toBe("a_b_c");
  });
});

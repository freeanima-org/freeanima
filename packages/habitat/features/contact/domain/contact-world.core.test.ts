import { describe, expect, test } from "bun:test";

import { isContactUserAccessPassthrough } from "./contact-world.ts";

describe("isContactUserAccessPassthrough", () => {
  test("user 免 Commons grant 校验", () => {
    expect(isContactUserAccessPassthrough("user")).toBe(true);
  });

  test("agent / 缺省不免校验", () => {
    expect(isContactUserAccessPassthrough("agent")).toBe(false);
    expect(isContactUserAccessPassthrough(undefined)).toBe(false);
  });
});

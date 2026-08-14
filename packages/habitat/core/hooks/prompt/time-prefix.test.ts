import { describe, expect, it } from "bun:test";

import {
  buildUserTimePrefixLine,
  stripUserTimePrefix,
  USER_TIME_PREFIX_RE,
} from "./time-prefix.ts";

describe("user time prefix", () => {
  it("builds XML time tag with CST weekday", () => {
    const line = buildUserTimePrefixLine(new Date("2026-05-20T08:02:00.000+08:00"));
    expect(line).toBe("<time>2026-05-20T08:02 周三</time>\n");
    expect(USER_TIME_PREFIX_RE.test(line ?? "")).toBe(true);
  });

  it("strips prefix and leaves body", () => {
    expect(stripUserTimePrefix("<time>2026-06-07T17:45 周日</time>\nhello")).toBe("hello");
    expect(stripUserTimePrefix("<time>2026-06-07T17:45</time>\nhello")).toBe("hello");
    expect(stripUserTimePrefix("hello")).toBe("hello");
  });
});

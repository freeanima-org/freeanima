import { describe, expect, test } from "bun:test";

import { parseQuickAddTitle } from "./quick-add-parse.ts";

const NOW = new Date(2026, 8, 2, 10, 0, 0); // 2026-09-02 Wed

describe("parseQuickAddTitle", () => {
  test("相对日", () => {
    expect(parseQuickAddTitle("明天买奶", NOW).title).toBe("买奶");
    expect(parseQuickAddTitle("明天买奶", NOW).start_at).toContain("2026-09-03");
    expect(parseQuickAddTitle("后天交报告", NOW).title).toBe("交报告");
  });

  test("周几", () => {
    const r = parseQuickAddTitle("下周五开会", NOW);
    expect(r.title).toBe("开会");
    expect(r.start_at).toContain("2026-09-11");
  });

  test("绝对日", () => {
    const r = parseQuickAddTitle("3月5日体检", NOW);
    expect(r.title).toBe("体检");
    expect(r.start_at).toContain("03-05");
  });

  test("无日期", () => {
    expect(parseQuickAddTitle("买牛奶", NOW)).toEqual({ title: "买牛奶", start_at: null });
  });
});

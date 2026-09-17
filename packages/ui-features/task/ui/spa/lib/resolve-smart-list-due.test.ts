import { describe, expect, test } from "bun:test";

import { cstCalendarDay, cstDayStartIso, resolveSmartListDueAt } from "./resolve-smart-list-due.ts";

describe("resolveSmartListDueAt", () => {
  const now = new Date("2026-07-18T10:00:00+08:00");
  const today = cstCalendarDay(now);

  test("due_on tomorrow → 明天 00:00 CST", () => {
    const iso = resolveSmartListDueAt({ status: "pending", due_on: "tomorrow" }, now);
    expect(iso).toBe(cstDayStartIso("2026-07-19"));
  });

  test("due_on today → 今天", () => {
    const iso = resolveSmartListDueAt({ status: "pending", due_on: "today" }, now);
    expect(iso).toBe(cstDayStartIso(today));
  });

  test("due_today true → 今天", () => {
    const iso = resolveSmartListDueAt({ status: "pending", due_today: true }, now);
    expect(iso).toBe(cstDayStartIso(today));
  });

  test("due_on_or_before_days 段 → 今天（距今最近）", () => {
    const iso = resolveSmartListDueAt(
      { status: "pending", has_due_at: true, due_on_or_before_days: 7 },
      now,
    );
    expect(iso).toBe(cstDayStartIso(today));
  });

  test("due_on_or_before_days 0（今天清单）→ 今天", () => {
    const iso = resolveSmartListDueAt(
      { status: "pending", has_due_at: true, due_on_or_before_days: 0 },
      now,
    );
    expect(iso).toBe(cstDayStartIso(today));
  });

  test("due_after / due_before 钳制到区间", () => {
    const iso = resolveSmartListDueAt(
      {
        status: "pending",
        due_after: "2026-07-20T00:00:00+08:00",
        due_before: "2026-07-25T00:00:00+08:00",
      },
      now,
    );
    expect(iso).toBe(cstDayStartIso("2026-07-20"));
  });

  test("无 due 约束 → null", () => {
    expect(resolveSmartListDueAt({ status: "pending" }, now)).toBeNull();
    expect(resolveSmartListDueAt({ status: "pending", has_due_at: true }, now)).toBeNull();
  });
});

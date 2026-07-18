import { describe, expect, it } from "bun:test";
import { CST_OFFSET_MS } from "@freeanima/core/util";
import {
  buildUserActivityWindows,
  cstCalendarDayString,
  cstDayBounds,
  cstRollingBounds,
  secondsUntilNextCstMidnight,
  shiftCstDay,
} from "./windows.ts";
import { formatUserActivityStatsPromptSection } from "./format.ts";

type Counts = { created: number; updated: number; user_messages: number };

function emptyStats(): Record<string, Counts> & {
  today: Counts;
  yesterday: Counts;
  day_before_yesterday: Counts;
  last_7d: Counts;
  last_30d: Counts;
  last_90d: Counts;
  last_365d: Counts;
} {
  const z = { created: 0, updated: 0, user_messages: 0 };
  return {
    today: { ...z },
    yesterday: { ...z },
    day_before_yesterday: { ...z },
    last_7d: { ...z },
    last_30d: { ...z },
    last_90d: { ...z },
    last_365d: { ...z },
  };
}

describe("user-activity-stats windows", () => {
  it("builds CST day bounds", () => {
    expect(cstDayBounds("2026-07-18")).toEqual({
      from_iso: "2026-07-18T00:00:00+08:00",
      to_iso: "2026-07-19T00:00:00+08:00",
    });
  });

  it("shifts across month boundary", () => {
    expect(shiftCstDay("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("rolling 7 days includes today and 6 days back", () => {
    expect(cstRollingBounds("2026-07-18", 7)).toEqual({
      from_iso: "2026-07-12T00:00:00+08:00",
      to_iso: "2026-07-19T00:00:00+08:00",
    });
  });

  it("buildUserActivityWindows returns seven labeled windows", () => {
    // 2026-07-18 12:00 CST = 2026-07-18 04:00 UTC
    const nowMs = Date.UTC(2026, 6, 18, 4, 0, 0);
    expect(cstCalendarDayString(nowMs)).toBe("2026-07-18");
    const { as_of_day, windows } = buildUserActivityWindows(nowMs);
    expect(as_of_day).toBe("2026-07-18");
    expect(windows.map((w) => w.label)).toEqual([
      "今天",
      "昨天",
      "前天",
      "近 7 天",
      "近 30 天",
      "近 90 天",
      "近 1 年",
    ]);
    expect(windows[0]?.from_iso).toBe("2026-07-18T00:00:00+08:00");
    expect(windows[1]?.from_iso).toBe("2026-07-17T00:00:00+08:00");
    expect(windows[2]?.from_iso).toBe("2026-07-16T00:00:00+08:00");
  });

  it("secondsUntilNextCstMidnight is positive", () => {
    const nowMs = Date.UTC(2026, 6, 18, 4, 0, 0);
    const sec = secondsUntilNextCstMidnight(nowMs);
    expect(sec).toBeGreaterThan(60);
    // until 2026-07-19 00:00 CST + 1h buffer
    const next = Date.parse("2026-07-19T00:00:00+08:00");
    expect(sec).toBe(Math.ceil((next - nowMs) / 1000) + 3600);
  });

  it("CST_OFFSET_MS geometry for calendar day", () => {
    const noonUtc = Date.UTC(2026, 6, 18, 4, 0, 0);
    expect(new Date(noonUtc + CST_OFFSET_MS).getUTCDate()).toBe(18);
  });
});

describe("user-activity-stats format", () => {
  it("renders panel lines", () => {
    const { as_of_day, windows } = buildUserActivityWindows(Date.UTC(2026, 6, 18, 4, 0, 0));
    const stats = emptyStats();
    stats.today = { created: 2, updated: 5, user_messages: 47 };
    const text = formatUserActivityStatsPromptSection(as_of_day, windows, stats);
    expect(text).toContain("## 用户活跃统计（截至 2026-07-18）");
    expect(text).toContain("今天：新开 2 / 更新 5 / 消息 47");
    expect(text).toContain("近 90 天：");
  });
});

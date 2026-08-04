import { logCapability as logComponent } from "@freeanima/host/core/config";
import {
  listTemporalSummariesInRange,
  upsertTemporalSummary,
} from "@freeanima/host/core/db/pg/temporal-summary";
import { cstDayRange } from "../light-sleep/build-messages.ts";
import {
  isCstMonthStart,
  isCstYearStart,
  lastDayOfMonthPeriod,
  monthPeriodStart,
  previousMonthPeriodStart,
  yearPeriodStart,
} from "./buckets.ts";
import { summarizeTemporalText } from "./summarize.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";

export type TemporalSummaryCascadeResult = {
  ok: boolean;
  day: string;
  month_id?: number;
  year_id?: number;
  summary: string;
  skipped?: string;
};

export type RebuildTemporalPeriodResult = {
  ok: boolean;
  entity_id?: number;
  summary: string;
  skipped?: string;
};

/** Rebuild month entity from day rows in that month (period_start = YYYY-MM-01). */
export async function rebuildMonthSummary(opts: {
  selfContent: string;
  config: ResolvedTemporalSummaryConfig;
  period_start: string;
}): Promise<RebuildTemporalPeriodResult> {
  const period_start = monthPeriodStart(opts.period_start);
  const period_end = lastDayOfMonthPeriod(period_start);
  const days = await listTemporalSummariesInRange({
    window: "day",
    period_start_from: period_start,
    period_start_to: period_end,
  });
  if (days.length === 0) {
    return { ok: true, summary: `no day rows for ${period_start}`, skipped: "no_days" };
  }
  try {
    const content = await summarizeTemporalText({
      selfContent: opts.selfContent,
      instruction: `请将 ${period_start} 至 ${period_end} 的全局天摘要合并为客观月摘要：一句级高度压缩，只留主题主线。`,
      material: days
        .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
        .map((d) => `[${d.period_start}]\n${d.content}`)
        .join("\n\n"),
      maxChars: opts.config.month_max_chars,
    });
    if (!content.trim()) {
      return { ok: true, summary: "empty month summary", skipped: "empty_summary" };
    }
    const entity_id = await upsertTemporalSummary({
      window: "month",
      period_start,
      content,
    });
    return { ok: true, entity_id, summary: `month ${period_start}→${entity_id}` };
  } catch (e) {
    logComponent("memory").warn("temporal month rebuild failed", {
      period_start,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      summary: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Rebuild year entity from month rows in that year (period_start = YYYY-01-01). */
export async function rebuildYearSummary(opts: {
  selfContent: string;
  config: ResolvedTemporalSummaryConfig;
  period_start: string;
}): Promise<RebuildTemporalPeriodResult> {
  const period_start = yearPeriodStart(opts.period_start);
  const y = period_start.slice(0, 4);
  const months = await listTemporalSummariesInRange({
    window: "month",
    period_start_from: period_start,
    period_start_to: `${y}-12-01`,
  });
  if (months.length === 0) {
    return { ok: true, summary: `no month rows for ${y}`, skipped: "no_months" };
  }
  try {
    const content = await summarizeTemporalText({
      selfContent: opts.selfContent,
      instruction: `请将 ${y} 年各月摘要合并为客观年摘要：一句级高度压缩，只留年度主线与重要结果。`,
      material: months
        .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
        .map((d) => `[${d.period_start}]\n${d.content}`)
        .join("\n\n"),
      maxChars: opts.config.year_max_chars,
    });
    if (!content.trim()) {
      return { ok: true, summary: "empty year summary", skipped: "empty_summary" };
    }
    const entity_id = await upsertTemporalSummary({
      window: "year",
      period_start,
      content,
    });
    return { ok: true, entity_id, summary: `year ${period_start}→${entity_id}` };
  } catch (e) {
    logComponent("memory").warn("temporal year rebuild failed", {
      period_start,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      summary: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * After a period ends: on month start → previous month; on Jan 1 → previous year.
 * Sleep day D is the *current* calendar day being processed (e.g. 2026-01-01).
 */
export async function runTemporalSummaryCascade(opts: {
  selfContent: string;
  config: ResolvedTemporalSummaryConfig;
  day?: string;
}): Promise<TemporalSummaryCascadeResult> {
  if (!opts.config.enabled) {
    return { ok: true, day: cstDayRange(opts.day).day, summary: "disabled", skipped: "disabled" };
  }
  const D = cstDayRange(opts.day).day;
  const parts: string[] = [];
  let month_id: number | undefined;
  let year_id: number | undefined;

  if (isCstMonthStart(D)) {
    const prevMonth = previousMonthPeriodStart(D);
    const monthResult = await rebuildMonthSummary({
      selfContent: opts.selfContent,
      config: opts.config,
      period_start: prevMonth,
    });
    if (!monthResult.ok) {
      return {
        ok: false,
        day: D,
        summary: monthResult.summary,
      };
    }
    if (monthResult.entity_id != null) {
      month_id = monthResult.entity_id;
      parts.push(monthResult.summary);
    }
  }

  if (isCstYearStart(D)) {
    const prevYear = `${Number(D.slice(0, 4)) - 1}-01-01`;
    const yearResult = await rebuildYearSummary({
      selfContent: opts.selfContent,
      config: opts.config,
      period_start: prevYear,
    });
    if (!yearResult.ok) {
      return {
        ok: false,
        day: D,
        summary: yearResult.summary,
        ...(month_id != null ? { month_id } : {}),
      };
    }
    if (yearResult.entity_id != null) {
      year_id = yearResult.entity_id;
      parts.push(yearResult.summary);
    }
  }

  if (parts.length === 0) {
    return {
      ok: true,
      day: D,
      summary: "no cascade triggers",
      skipped: "no_trigger",
    };
  }
  return {
    ok: true,
    day: D,
    summary: parts.join("; "),
    ...(month_id != null ? { month_id } : {}),
    ...(year_id != null ? { year_id } : {}),
  };
}

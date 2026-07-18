import { logCapability as logComponent } from "@freeanima/core/config";
import {
  listTemporalSummariesInRange,
  upsertTemporalSummary,
} from "@freeanima/core/db/pg/temporal-summary";
import { cstDayRange } from "../light-sleep/build-messages.ts";
import { isCstMonthEnd, isCstYearEnd, monthPeriodStart, yearPeriodStart } from "./buckets.ts";
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

  if (isCstMonthEnd(D)) {
    const period_start = monthPeriodStart(D);
    const days = await listTemporalSummariesInRange({
      window: "day",
      period_start_from: period_start,
      period_start_to: D,
    });
    if (days.length > 0) {
      try {
        const content = await summarizeTemporalText({
          selfContent: opts.selfContent,
          instruction: `请将 ${period_start} 至 ${D} 的全局天摘要合并为客观月摘要。`,
          material: days
            .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
            .map((d) => `[${d.period_start}]\n${d.content}`)
            .join("\n\n"),
          maxChars: opts.config.month_max_chars,
        });
        if (content.trim()) {
          month_id = await upsertTemporalSummary({
            window: "month",
            period_start,
            content,
          });
          parts.push(`month ${period_start}→${month_id}`);
        }
      } catch (e) {
        logComponent("memory").warn("temporal month cascade failed", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (isCstYearEnd(D)) {
    const period_start = yearPeriodStart(D);
    const months = await listTemporalSummariesInRange({
      window: "month",
      period_start_from: period_start,
      period_start_to: `${D.slice(0, 4)}-12-01`,
    });
    if (months.length > 0) {
      try {
        const content = await summarizeTemporalText({
          selfContent: opts.selfContent,
          instruction: `请将 ${D.slice(0, 4)} 年各月摘要合并为客观年摘要。`,
          material: months
            .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
            .map((d) => `[${d.period_start}]\n${d.content}`)
            .join("\n\n"),
          maxChars: opts.config.year_max_chars,
        });
        if (content.trim()) {
          year_id = await upsertTemporalSummary({
            window: "year",
            period_start,
            content,
          });
          parts.push(`year ${period_start}→${year_id}`);
        }
      } catch (e) {
        logComponent("memory").warn("temporal year cascade failed", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
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

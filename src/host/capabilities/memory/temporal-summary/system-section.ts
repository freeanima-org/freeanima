import {
  getTemporalSummary,
  listTemporalSummariesInRange,
} from "@freeanima/host/core/db/pg/temporal-summary";
import { cstDateString, monthPeriodStart, yearPeriodStart } from "./buckets.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";

function addCstDays(cstDate: string, delta: number): string {
  const parts = cstDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y == null || m == null || d == null) return cstDate;
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Build system prompt section for yesterday … earlier (excludes today). */
export async function buildTemporalSummarySystemSection(
  config: ResolvedTemporalSummaryConfig,
  nowMs: number = Date.now(),
): Promise<string> {
  if (!config.enabled) return "";
  const today = cstDateString(nowMs);
  const sections: string[] = [];

  const yesterday = addCstDays(today, -1);
  const yRow = await getTemporalSummary("day", yesterday);
  if (yRow?.content.trim()) {
    sections.push(`### 昨天（${yesterday}）\n${yRow.content.trim()}`);
  }

  const d7 = addCstDays(today, -7);
  const d2 = addCstDays(today, -2);
  const near7 = await listTemporalSummariesInRange({
    window: "day",
    period_start_from: d7,
    period_start_to: d2,
  });
  if (near7.length > 0) {
    const body = near7
      .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
      .map((r) => `- ${r.period_start}: ${r.content.trim()}`)
      .join("\n");
    sections.push(`### 近 7 天（${d7} … ${d2}）\n${body}`);
  }

  const d30 = addCstDays(today, -30);
  const d8 = addCstDays(today, -8);
  const monthsNear = await listTemporalSummariesInRange({
    window: "month",
    period_start_from: monthPeriodStart(d30),
    period_start_to: monthPeriodStart(d8),
  });
  if (monthsNear.length > 0) {
    const body = monthsNear
      .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
      .map((r) => `- ${r.period_start}: ${r.content.trim()}`)
      .join("\n");
    sections.push(`### 近 30 天量级（月摘要）\n${body}`);
  } else {
    const days30 = await listTemporalSummariesInRange({
      window: "day",
      period_start_from: d30,
      period_start_to: d8,
    });
    if (days30.length > 0) {
      const body = days30
        .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
        .map((r) => `- ${r.period_start}: ${r.content.trim()}`)
        .join("\n");
      sections.push(`### 近 30 天（${d30} … ${d8}）\n${body}`);
    }
  }

  const d90 = addCstDays(today, -90);
  const d31 = addCstDays(today, -31);
  const months90 = await listTemporalSummariesInRange({
    window: "month",
    period_start_from: monthPeriodStart(d90),
    period_start_to: monthPeriodStart(d31),
  });
  if (months90.length > 0) {
    const body = months90
      .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
      .map((r) => `- ${r.period_start}: ${r.content.trim()}`)
      .join("\n");
    sections.push(`### 近 90 天（月摘要）\n${body}`);
  }

  const d365 = addCstDays(today, -365);
  const d91 = addCstDays(today, -91);
  const monthsYear = await listTemporalSummariesInRange({
    window: "month",
    period_start_from: monthPeriodStart(d365),
    period_start_to: monthPeriodStart(d91),
  });
  if (monthsYear.length > 0) {
    const body = monthsYear
      .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
      .map((r) => `- ${r.period_start}: ${r.content.trim()}`)
      .join("\n");
    sections.push(`### 近一年（月摘要）\n${body}`);
  }

  const earlierYear = yearPeriodStart(addCstDays(today, -366));
  const years = await listTemporalSummariesInRange({
    window: "year",
    period_start_from: "1970-01-01",
    period_start_to: earlierYear,
  });
  if (years.length > 0) {
    const body = years
      .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
      .map((r) => `- ${r.period_start}: ${r.content.trim()}`)
      .join("\n");
    sections.push(`### 更早（年摘要）\n${body}`);
  }

  if (sections.length === 0) return "";
  let text = `## 时间摘要\n\n${sections.join("\n\n")}`;
  if (text.length > config.system_prompt_max_chars) {
    text = `${text.slice(0, config.system_prompt_max_chars)}\n…`;
  }
  return text;
}

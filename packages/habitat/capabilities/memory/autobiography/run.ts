import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import type { AutobiographicalMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import type { AutobiographicalSignificance } from "@freeanima/habitat/core/db/pg/autobiographical-memory/types";
import { autobiographicalSignificanceSchema } from "@freeanima/habitat/core/db/schema/entity";
import { formatCstIso, omitUndefined } from "@freeanima/habitat/core/util";

const LOOKBACK_DAYS = 7;

export type RunSelfAutobiographyOpts = {
  selfContent: string;
  sinceIso?: string;
};

export type SelfAutobiographyResult = {
  ok: boolean;
  skipped?: string;
  narratives_created: number;
  tool_calls: number;
  /** Always false — self-layer autobiography_summary retired */
  summary_refreshed: boolean;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export const AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS: Record<AutobiographicalSignificance, string> =
  {
    turning_point: "## Turning points",
    milestone: "## Milestones",
    normal: "## Recent narratives",
  };

const SUMMARY_SECTION_ORDER: AutobiographicalSignificance[] = [
  "turning_point",
  "milestone",
  "normal",
];

export function parseRowAgeDays(row: AutobiographicalMemoryRow): number {
  const ms = row.period_end
    ? Date.parse(row.period_end)
    : (row.updated_at ?? row.created_at).getTime();
  if (Number.isNaN(ms)) return 9999;
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

function shouldIncludeInSummary(row: AutobiographicalMemoryRow, ageDays: number): boolean {
  if (ageDays > 180 && row.significance !== "turning_point") return false;
  if (ageDays > 30 && row.significance === "normal") return false;
  return true;
}

function formatSummarySection(
  significance: AutobiographicalSignificance,
  titles: string[],
): string {
  const heading = AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS[significance];
  return [heading, ...titles.map((title) => `- ${title}`)].join("\n");
}

/**
 * Build grouped outline from active autobiographical entries (granularity decreases with age).
 * Kept for read-only / diagnostic use; no longer written into the self layer.
 */
export function buildAutobiographySummary(rows: AutobiographicalMemoryRow[]): string {
  if (rows.length === 0) return "(No autobiography summary yet)";

  const buckets: Record<AutobiographicalSignificance, string[]> = {
    turning_point: [],
    milestone: [],
    normal: [],
  };

  for (const row of rows) {
    const ageDays = parseRowAgeDays(row);
    if (!shouldIncludeInSummary(row, ageDays)) continue;
    const significance = autobiographicalSignificanceSchema.parse(row.significance);
    buckets[significance].push(row.title);
  }

  const hasAny =
    buckets.turning_point.length > 0 || buckets.milestone.length > 0 || buckets.normal.length > 0;

  if (!hasAny) {
    buckets.turning_point = rows
      .filter((row) => row.significance === "turning_point")
      .slice(0, 5)
      .map((row) => row.title);
  }

  const sections: string[] = [];
  for (const significance of SUMMARY_SECTION_ORDER) {
    const titles = buckets[significance];
    if (titles.length === 0) continue;
    sections.push(formatSummarySection(significance, titles));
  }

  return sections.length > 0 ? sections.join("\n\n") : "(No autobiography summary yet)";
}

/** @deprecated Self-layer autobiography_summary retired; always returns false */
export async function refreshAutobiographySummaryBlock(): Promise<boolean> {
  return false;
}

/**
 * Manual / diagnostic autobiography extraction. Sleep cycle no longer calls this;
 * narrative write tools removed — always skip (park / deleted tools).
 * Existing narrative entities remain readable via content_block_search(component=narrative).
 */
export async function runSelfAutobiography(
  opts: RunSelfAutobiographyOpts,
): Promise<SelfAutobiographyResult> {
  const sinceIso = opts.sinceIso ?? daysAgoIso(LOOKBACK_DAYS);
  void opts.selfContent;
  logComponent("memory").info("autobiography cron skipped narrative extraction", {
    reason: "write_tools_removed",
    since: sinceIso,
  });
  return omitUndefined({
    ok: true,
    skipped: "park/已删工具：memory_autobiographical_create|deprecate 已移除，跳过叙事写入",
    narratives_created: 0,
    tool_calls: 0,
    summary_refreshed: false,
  });
}

export async function runSelfAutobiographyWithLog(
  opts: RunSelfAutobiographyOpts,
): Promise<SelfAutobiographyResult> {
  const startedAt = formatCstIso();
  const result = await runSelfAutobiography(opts);
  logComponent("memory").info("autobiography cron finished", { started_at: startedAt, ...result });
  return result;
}

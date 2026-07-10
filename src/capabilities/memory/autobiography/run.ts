import { logCapability as logComponent } from "@freeanima/core/config";
import type { AutobiographicalMemoryRow } from "@freeanima/core/db/schema/rows";
import type { AutobiographicalSignificance } from "@freeanima/core/db/pg/autobiographical-memory/types";
import { autobiographicalSignificanceSchema } from "@freeanima/core/db/schema";
import { formatCstIso, omitUndefined } from "@freeanima/core/util";
import { listActiveAutobiographicalMemory } from "@freeanima/core/db/pg/autobiographical-memory";
import { searchSemanticMemory } from "@freeanima/core/db/pg/semantic-memory";
import { updateSelfBlock } from "@freeanima/core/db/pg/self-layer";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { runAutobiographyEngine } from "../autobiography-port.ts";
import { buildAutobiographyUserMessages } from "./build-messages.ts";

const AUTOBIOGRAPHY_TOOL_NAMES = [
  "memory_autobiographical_create",
  "memory_autobiographical_deprecate",
] as const;

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
  summary_refreshed: boolean;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function listRecentExperienceImprint(sinceIso: string) {
  const rows = await searchSemanticMemory({
    types: ["experience", "imprint"],
    status: "active",
    limit: 100,
  });
  const sinceMs = Date.parse(sinceIso);
  return rows.filter((row) => {
    const ts = (row.updated_at ?? row.created_at).getTime();
    return ts >= sinceMs;
  });
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

/** Build grouped outline from active autobiographical entries (granularity decreases with age) */
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

export async function refreshAutobiographySummaryBlock(): Promise<boolean> {
  const active = await listActiveAutobiographicalMemory({ order: "significance_desc", limit: 200 });
  const summary = buildAutobiographySummary(active);
  await updateSelfBlock({
    block_key: "autobiography_summary",
    content: summary,
    updated_by: "autobiography_cron",
  });
  return true;
}

export async function runSelfAutobiography(
  opts: RunSelfAutobiographyOpts,
): Promise<SelfAutobiographyResult> {
  const sinceIso = opts.sinceIso ?? daysAgoIso(LOOKBACK_DAYS);
  const candidates = await listRecentExperienceImprint(sinceIso);
  const existing = await listActiveAutobiographicalMemory({ limit: 200 });

  let narrativesCreated = 0;
  let toolCalls = 0;

  if (candidates.length > 0) {
    const parts = await decomposeSystemPromptParts(opts.selfContent, null);
    const systemPrompt = composeSystemPrompt(parts);
    const userMessages = buildAutobiographyUserMessages(candidates, existing);

    const engineResult = await runAutobiographyEngine({
      systemPrompt,
      userMessages,
      toolNames: [...AUTOBIOGRAPHY_TOOL_NAMES],
    });
    toolCalls = engineResult.tool_calls;

    const after = await listActiveAutobiographicalMemory({ limit: 200 });
    narrativesCreated = Math.max(0, after.length - existing.length);

    logComponent("memory").info("autobiography cron narrative stage completed", {
      candidates: candidates.length,
      tool_calls: toolCalls,
      narratives_created: narrativesCreated,
      summary: engineResult.summary.slice(0, 200),
    });
  } else {
    logComponent("memory").info("autobiography cron skipped narrative extraction", {
      reason: "no_recent_experience_imprint",
      since: sinceIso,
    });
  }

  const summaryRefreshed = await refreshAutobiographySummaryBlock();

  return omitUndefined({
    ok: true,
    skipped:
      candidates.length === 0
        ? "No recent experience/imprint; skipped narrative extraction"
        : undefined,
    narratives_created: narrativesCreated,
    tool_calls: toolCalls,
    summary_refreshed: summaryRefreshed,
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

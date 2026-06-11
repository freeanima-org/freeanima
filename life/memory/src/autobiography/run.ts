import type {
  AutobiographicalMemoryRow,
  AutobiographicalMemoryStorePort,
  SelfLayerStorePort,
  SemanticMemoryStorePort,
} from "@freeanima/engine-repos";
import { logComponent } from "@freeanima/service-logging";
import { formatCstIso } from "@freeanima/engine-util";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { runAutobiographyEngine } from "../autobiography-port.ts";
import { buildAutobiographyUserMessages } from "./build-messages.ts";

const AUTOBIOGRAPHY_TOOL_NAMES = [
  "memory_autobiographical_create",
  "memory_autobiographical_deprecate",
] as const;

const LOOKBACK_DAYS = 7;

export type RunSelfAutobiographyOpts = {
  semanticStore: SemanticMemoryStorePort;
  autoStore: AutobiographicalMemoryStorePort;
  selfStore: SelfLayerStorePort;
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

async function listRecentExperienceImprint(
  store: SemanticMemoryStorePort,
  sinceIso: string,
): Promise<Awaited<ReturnType<SemanticMemoryStorePort["search"]>>> {
  const rows = await store.search({
    types: ["experience", "imprint"],
    status: "active",
    limit: 100,
  });
  const sinceMs = Date.parse(sinceIso);
  return rows.filter((row) => {
    const ts = Date.parse(row.updated || row.created);
    return !Number.isNaN(ts) && ts >= sinceMs;
  });
}

function parseRowAgeDays(row: AutobiographicalMemoryRow): number {
  const raw = row.period_end ?? row.updated ?? row.created;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return 9999;
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

/** Build summary from active autobiographical entries (granularity decreases with age) */
export function buildAutobiographySummary(rows: AutobiographicalMemoryRow[]): string {
  if (!rows.length) return "(No autobiography summary yet)";

  const lines: string[] = [];
  for (const row of rows) {
    const ageDays = parseRowAgeDays(row);
    if (ageDays > 180 && row.significance !== "turning_point") continue;
    if (ageDays > 30 && row.significance === "normal") continue;

    const tag =
      row.significance === "turning_point"
        ? "Turning point"
        : row.significance === "milestone"
          ? "Milestone"
          : "Narrative";
    const essence = ageDays <= 30 ? row.content.slice(0, 120) : row.title;
    lines.push(
      `- [${tag}] ${row.title}: ${essence}${essence.length < row.content.length ? "…" : ""}`,
    );
  }

  if (!lines.length) {
    const turning = rows.filter((r) => r.significance === "turning_point");
    for (const row of turning.slice(0, 5)) {
      lines.push(`- [Turning point] ${row.title}`);
    }
  }

  return lines.length ? lines.join("\n") : "(No autobiography summary yet)";
}

export async function refreshAutobiographySummaryBlock(
  autoStore: AutobiographicalMemoryStorePort,
  selfStore: SelfLayerStorePort,
): Promise<boolean> {
  const active = await autoStore.listActive({ order: "significance_desc", limit: 200 });
  const summary = buildAutobiographySummary(active);
  await selfStore.updateBlock({
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
  const candidates = await listRecentExperienceImprint(opts.semanticStore, sinceIso);
  const existing = await opts.autoStore.listActive({ limit: 200 });

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

    const after = await opts.autoStore.listActive({ limit: 200 });
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

  const summaryRefreshed = await refreshAutobiographySummaryBlock(opts.autoStore, opts.selfStore);

  return {
    ok: true,
    skipped:
      candidates.length === 0
        ? "No recent experience/imprint; skipped narrative extraction"
        : undefined,
    narratives_created: narrativesCreated,
    tool_calls: toolCalls,
    summary_refreshed: summaryRefreshed,
  };
}

export async function runSelfAutobiographyWithLog(
  opts: RunSelfAutobiographyOpts,
): Promise<SelfAutobiographyResult> {
  const startedAt = formatCstIso();
  const result = await runSelfAutobiography(opts);
  logComponent("memory").info("autobiography cron finished", { started_at: startedAt, ...result });
  return result;
}

import type {
  AutobiographicalMemoryRow,
  AutobiographicalMemoryStorePort,
  SelfLayerStorePort,
  SemanticMemoryStorePort,
} from "@freeanima/engine-repos";
import { logComponent } from "@freeanima/service-logging";
import { formatCstIso } from "@freeanima/kernel-util";

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

/** 从 active 自传条目生成 summary（粒度随距离递减） */
export function buildAutobiographySummary(rows: AutobiographicalMemoryRow[]): string {
  if (!rows.length) return "（尚未形成自传概括）";

  const lines: string[] = [];
  for (const row of rows) {
    const ageDays = parseRowAgeDays(row);
    if (ageDays > 180 && row.significance !== "turning_point") continue;
    if (ageDays > 30 && row.significance === "normal") continue;

    const tag =
      row.significance === "turning_point"
        ? "转折点"
        : row.significance === "milestone"
          ? "里程碑"
          : "叙事";
    const essence = ageDays <= 30 ? row.content.slice(0, 120) : row.title;
    lines.push(
      `- [${tag}] ${row.title}：${essence}${essence.length < row.content.length ? "…" : ""}`,
    );
  }

  if (!lines.length) {
    const turning = rows.filter((r) => r.significance === "turning_point");
    for (const row of turning.slice(0, 5)) {
      lines.push(`- [转折点] ${row.title}`);
    }
  }

  return lines.length ? lines.join("\n") : "（尚未形成自传概括）";
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

    logComponent("memory").info("自传 cron 叙事阶段完成", {
      candidates: candidates.length,
      tool_calls: toolCalls,
      narratives_created: narrativesCreated,
      summary: engineResult.summary.slice(0, 200),
    });
  } else {
    logComponent("memory").info("自传 cron 跳过叙事提取", {
      reason: "no_recent_experience_imprint",
      since: sinceIso,
    });
  }

  const summaryRefreshed = await refreshAutobiographySummaryBlock(opts.autoStore, opts.selfStore);

  return {
    ok: true,
    skipped: candidates.length === 0 ? "无近期 experience/imprint，跳过叙事提取" : undefined,
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
  logComponent("memory").info("自传 cron 结束", { started_at: startedAt, ...result });
  return result;
}

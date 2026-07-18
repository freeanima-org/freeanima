import { logCapability as logComponent } from "@freeanima/core/config";
import { listConversationIdsUpdatedBetween } from "@freeanima/core/db/pg/conversation";
import { upsertTemporalSummary } from "@freeanima/core/db/pg/temporal-summary";
import { collectConversationBlocks, cstDayRange } from "../light-sleep/build-messages.ts";
import { summarizeTemporalText } from "./summarize.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";

export type TemporalSummaryDayResult = {
  ok: boolean;
  day: string;
  entity_id?: number;
  summary: string;
  skipped?: string;
};

export async function runTemporalSummaryDay(opts: {
  selfContent: string;
  config: ResolvedTemporalSummaryConfig;
  day?: string;
}): Promise<TemporalSummaryDayResult> {
  if (!opts.config.enabled) {
    return { ok: true, day: cstDayRange(opts.day).day, summary: "disabled", skipped: "disabled" };
  }
  const range = cstDayRange(opts.day);
  const conversationIds = await listConversationIdsUpdatedBetween(range.fromIso, range.toIso);
  if (conversationIds.length === 0) {
    return {
      ok: true,
      day: range.day,
      summary: "No conversation activity; skip global day",
      skipped: "no_sessions",
    };
  }

  const blocks = await collectConversationBlocks(conversationIds);
  const material = blocks.map((b) => b.text).join("\n\n");
  if (!material.trim()) {
    return {
      ok: true,
      day: range.day,
      summary: "Empty dialogue; skip",
      skipped: "empty",
    };
  }

  let content: string;
  try {
    content = await summarizeTemporalText({
      selfContent: opts.selfContent,
      instruction: `请为 ${range.day}（CST）生成全局客观天摘要：覆盖当日各会话实际发生的事件主题与结果；无差别、不抒情，勿日志级细碎复述。`,
      material,
      maxChars: opts.config.global_day_max_chars,
    });
  } catch (e) {
    logComponent("memory").warn("temporal day summarize failed", {
      day: range.day,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      day: range.day,
      summary: e instanceof Error ? e.message : String(e),
    };
  }
  if (!content.trim()) {
    return { ok: true, day: range.day, summary: "empty summary", skipped: "empty_summary" };
  }

  const entity_id = await upsertTemporalSummary({
    window: "day",
    period_start: range.day,
    content,
  });
  return {
    ok: true,
    day: range.day,
    entity_id,
    summary: `global day ${range.day} → entity ${entity_id}`,
  };
}

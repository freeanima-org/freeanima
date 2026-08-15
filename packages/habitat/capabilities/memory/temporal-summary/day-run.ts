import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { listConversationIdsWithMessagesBetween } from "@freeanima/habitat/core/db/pg/conversation";
import { upsertTemporalSummary } from "@freeanima/habitat/core/db/pg/temporal-summary";
import { collectConversationBlocks, cstDayRange } from "../day-window/build-messages.ts";
import { summarizeTemporalText, TEMPORAL_SUMMARY_INSTRUCTIONS } from "./summarize.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";

export type TemporalSummaryDayResult = {
  ok: boolean;
  day: string;
  entity_id?: number;
  summary: string;
  skipped?: string;
};

async function upsertEmptyDay(opts: {
  day: string;
  empty_reason: string;
  source_count: number;
  summary: string;
}): Promise<TemporalSummaryDayResult> {
  const entity_id = await upsertTemporalSummary({
    window: "day",
    period_start: opts.day,
    content: "",
    empty_reason: opts.empty_reason,
    source_count: opts.source_count,
  });
  return {
    ok: true,
    day: opts.day,
    entity_id,
    summary: opts.summary,
    skipped: opts.empty_reason,
  };
}

export async function runTemporalSummaryDay(opts: {
  config: ResolvedTemporalSummaryConfig;
  day?: string;
}): Promise<TemporalSummaryDayResult> {
  if (!opts.config.enabled) {
    return { ok: true, day: cstDayRange(opts.day).day, summary: "disabled", skipped: "disabled" };
  }
  const range = cstDayRange(opts.day);
  // Align with tick: message payload.timestamp activity, not conversations.updated_at.
  const conversationIds = await listConversationIdsWithMessagesBetween(range.fromIso, range.toIso);
  if (conversationIds.length === 0) {
    return upsertEmptyDay({
      day: range.day,
      empty_reason: "no_sessions",
      source_count: 0,
      summary: "No conversation activity; skip global day",
    });
  }

  const blocks = await collectConversationBlocks(conversationIds, range);
  const material = blocks.map((b) => b.text).join("\n\n");
  if (!material.trim()) {
    return upsertEmptyDay({
      day: range.day,
      empty_reason: "empty",
      source_count: conversationIds.length,
      summary: "Empty dialogue; skip",
    });
  }

  let content: string;
  try {
    content = await summarizeTemporalText({
      instruction: TEMPORAL_SUMMARY_INSTRUCTIONS.globalDay,
      params: { day: range.day },
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
    return upsertEmptyDay({
      day: range.day,
      empty_reason: "empty_summary",
      source_count: conversationIds.length,
      summary: "empty summary",
    });
  }

  const entity_id = await upsertTemporalSummary({
    window: "day",
    period_start: range.day,
    content,
    empty_reason: null,
    source_count: conversationIds.length,
  });
  return {
    ok: true,
    day: range.day,
    entity_id,
    summary: `global day ${range.day} → entity ${entity_id}`,
  };
}

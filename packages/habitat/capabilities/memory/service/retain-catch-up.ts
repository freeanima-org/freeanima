/**
 * 按 CST 日补跑 retain：当日有消息的会话各 retain 一次（force）。
 */

import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import {
  listConversationIdsUpdatedBetween,
  listMessageRowsPage,
} from "@freeanima/habitat/core/db/pg/conversation";

import { collectConversationBlocks, cstDayRange } from "../light-sleep/build-messages.ts";
import { createEmbeddedMemoryService } from "./embedded.ts";

export type RetainCatchUpResult = {
  ok: boolean;
  day: string;
  conversations: number;
  retained: number;
  skipped: number;
  errors: number;
  summary: string;
  skipped_reason?: string;
};

export async function runRetainCatchUp(opts: { day?: string } = {}): Promise<RetainCatchUpResult> {
  const range = cstDayRange(opts.day);
  const conversationIds = await listConversationIdsUpdatedBetween(range.fromIso, range.toIso);
  if (conversationIds.length === 0) {
    return {
      ok: true,
      day: range.day,
      conversations: 0,
      retained: 0,
      skipped: 0,
      errors: 0,
      summary: "No conversation activity; skipping retain catch-up",
      skipped_reason: "no_sessions",
    };
  }

  const blocks = await collectConversationBlocks(conversationIds, range);
  const activeIds = blocks.map((b) => b.conversationId);
  if (activeIds.length === 0) {
    return {
      ok: true,
      day: range.day,
      conversations: 0,
      retained: 0,
      skipped: 0,
      errors: 0,
      summary: "No messages in day window; skipping retain catch-up",
      skipped_reason: "no_day_messages",
    };
  }

  const svc = createEmbeddedMemoryService();
  let retained = 0;
  let skipped = 0;
  let errors = 0;

  for (const conversation_id of activeIds) {
    try {
      const rows = await listMessageRowsPage(conversation_id, 0, 500);
      const message_ids = rows.map((m) => m.message_id).filter(Boolean);
      if (message_ids.length === 0) {
        skipped += 1;
        continue;
      }
      const result = await svc.retain({
        conversation_id,
        message_ids,
        force: true,
      });
      if (result.skipped) skipped += 1;
      else retained += 1;
    } catch (err) {
      errors += 1;
      logComponent("memory").warn("retain catch-up conversation failed", {
        conversation_id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: errors === 0,
    day: range.day,
    conversations: activeIds.length,
    retained,
    skipped,
    errors,
    summary: `retain-catch-up:${range.day}:ok=${retained}:skip=${skipped}:err=${errors}`,
  };
}

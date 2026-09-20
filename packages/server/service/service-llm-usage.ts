import { isPostgresPrimary } from "@freeanima/core/db/pg";
import { sumConversationUsageBetween } from "@freeanima/core/db/pg/conversation";
import { sumAutoLlmUsageBetween } from "@freeanima/core/db/pg/auto-llm-run";
import { hostDayBoundsIso } from "@freeanima/core/util";
import {
  addLlmUsageTotals,
  emptyLlmUsageTotals,
  type LlmUsageTotals,
} from "@freeanima/shared/llm-usage";
import type { RuntimeDeps } from "@freeanima/capabilities/ports/runtime-deps.ts";

export type UsageTodayResult = {
  day: string;
  conversation: LlmUsageTotals;
  auto_llm: LlmUsageTotals;
  total: LlmUsageTotals;
};

export async function getUsageToday(_deps: RuntimeDeps): Promise<UsageTodayResult> {
  const { day, fromIso, toIso } = hostDayBoundsIso();
  if (!isPostgresPrimary()) {
    const empty = emptyLlmUsageTotals();
    return { day, conversation: empty, auto_llm: empty, total: empty };
  }
  const [conversation, auto_llm] = await Promise.all([
    sumConversationUsageBetween(fromIso, toIso),
    sumAutoLlmUsageBetween(fromIso, toIso),
  ]);
  return {
    day,
    conversation,
    auto_llm,
    total: addLlmUsageTotals(conversation, auto_llm),
  };
}

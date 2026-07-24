import { appendMessage, shiftMessagePositions } from "@freeanima/host/core/db/pg/conversation";
import type { StoredMessage } from "@freeanima/host/core/db/domain";
import { formatCstIso } from "@freeanima/host/core/util";
import { getRuntimeLogger } from "@freeanima/host/core/config";
import {
  countFollowingToolMessages,
  detectToolLoopCorruption,
  syntheticToolContent,
  REPAIR_REASON_LOST,
} from "./tool-loop-integrity.ts";

/** Write missing tool responses to PG (insert in-place after assistant; shift later pos) */
export async function repairAndPersistToolLoop(
  conversationId: string,
  msgs: StoredMessage[],
  loadMessages: (conversationId: string) => Promise<StoredMessage[]>,
  reason = REPAIR_REASON_LOST,
): Promise<boolean> {
  const corruptions = detectToolLoopCorruption(msgs);
  if (corruptions.length === 0) return false;

  const ordered = [...corruptions].toSorted(
    (a, b) => (b.assistantPos ?? 0) - (a.assistantPos ?? 0),
  );

  let inserted = 0;
  for (const c of ordered) {
    if (c.assistantPos === undefined) continue;

    const current = await loadMessages(conversationId);
    const idx = current.findIndex((m) => m.pos === c.assistantPos);
    if (idx < 0) continue;

    const following = countFollowingToolMessages(current, idx);
    const insertAtPos = c.assistantPos + 1 + following;
    const n = c.missingCalls.length;
    if (n === 0) continue;

    await shiftMessagePositions(conversationId, insertAtPos - 1, n);

    for (let i = 0; i < n; i++) {
      const call = c.missingCalls[i];
      if (call === undefined) continue;
      await appendMessage(conversationId, {
        role: "tool",
        pos: insertAtPos + i,
        tool_call_id: call.id,
        name: call.name,
        content: syntheticToolContent(reason),
        timestamp: formatCstIso(),
      });
      inserted++;
    }
  }

  getRuntimeLogger()
    .with({ component: "tool-loop-integrity" })
    .error(
      `tool loop history repaired: conversation=${conversationId} inserted in-place ${inserted} synthetic tool message(s)`,
    );
  return true;
}

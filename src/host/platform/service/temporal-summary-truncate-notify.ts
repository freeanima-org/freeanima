import { getNotificationPort } from "@freeanima/host/capabilities/tools/notification";
import { temporalSummarySystemTruncatedSourceRef } from "@freeanima/host/capabilities/memory/temporal-summary";
import { logCapability as logComponent } from "@freeanima/host/core/config/capability-injection";

/**
 * When temporal-summary system section was truncated, warn user+agent Inbox.
 * Deduped once per CST day via source_ref.
 */
export async function notifyTemporalSummarySystemTruncated(opts: {
  maxChars: number;
  nowMs?: number;
}): Promise<"notified" | "deduped" | "skipped"> {
  const port = getNotificationPort();
  if (!port) return "skipped";

  const nowMs = opts.nowMs ?? Date.now();
  const sourceRef = temporalSummarySystemTruncatedSourceRef(nowMs);
  const user = port.getUserRecipient();
  const agent = port.getAgentRecipient();
  const [userExists, agentExists] = await Promise.all([
    port.existsBySourceRef(sourceRef, user),
    port.existsBySourceRef(sourceRef, agent),
  ]);
  if (userExists && agentExists) return "deduped";

  const title = "时间摘要 system 段已截断";
  const body = [
    `时间摘要写入 system prompt 时超过上限（约 ${opts.maxChars} 字），已截断。`,
    "这不是记忆主区；若反复出现，请检查历史日/月/年摘要是否过长，或酌情提高 memory.temporal_summary.system_prompt_max_chars。",
  ].join("\n");

  try {
    if (!userExists) {
      await port.create({
        recipient_kind: user.kind,
        recipient_id: user.id,
        title,
        body,
        source_kind: "system",
        source_ref: sourceRef,
        payload: { kind: "temporal_summary_system_truncated", max_chars: opts.maxChars },
      });
    }
    if (!agentExists) {
      await port.create({
        recipient_kind: agent.kind,
        recipient_id: agent.id,
        title,
        body,
        source_kind: "system",
        source_ref: sourceRef,
        payload: { kind: "temporal_summary_system_truncated", max_chars: opts.maxChars },
      });
    }
    return "notified";
  } catch (e) {
    logComponent("memory").warn("temporal summary truncate notify failed", {
      error: e instanceof Error ? e.message : String(e),
      source_ref: sourceRef,
    });
    return "skipped";
  }
}

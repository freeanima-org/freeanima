import type { AssistantMessage, StoredMessage } from "@freeanima/core/db/domain";

export const TEMPORAL_SUMMARY_PEERS_ASSISTANT_NAME = "temporal_summary_peers";

export type TimelinePeerInject = {
  /** ISO time to place after last message with t <= at */
  at: string;
  content: string;
};

export function isTemporalSummaryPeersAssistant(msg: StoredMessage): msg is AssistantMessage {
  return msg.role === "assistant" && msg.name === TEMPORAL_SUMMARY_PEERS_ASSISTANT_NAME;
}

export function stripTemporalSummaryPeersFromMessages(messages: StoredMessage[]): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg !== undefined && isTemporalSummaryPeersAssistant(msg)) {
      messages.splice(i, 1);
    }
  }
}

function messageTimeMs(msg: StoredMessage): number | null {
  if (msg.role === "conversation_meta") return null;
  if (!("timestamp" in msg) || typeof msg.timestamp !== "string" || !msg.timestamp.trim()) {
    return null;
  }
  const ms = Date.parse(msg.timestamp);
  return Number.isNaN(ms) ? null : ms;
}

/** 勿插到 leading system 之前，否则 storedMessagesToInvokeInput 抽不到 systemPrompt。 */
function minInsertIndexAfterLeadingSystem(messages: StoredMessage[]): number {
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (!msg) break;
    if (msg.role === "conversation_meta" || msg.role === "system") {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

/**
 * Insert peer rollup blocks at chronological positions (runtime-only).
 * Deterministic: sorted by (at, content); inserts after last message with t <= at.
 * Never inserts before leading system / conversation_meta.
 */
export function injectTemporalPeerRollups(
  messages: StoredMessage[],
  injects: TimelinePeerInject[],
): void {
  stripTemporalSummaryPeersFromMessages(messages);
  const ordered = injects
    .filter((i) => i.content.trim().length > 0)
    .toSorted((a, b) => {
      const c = a.at.localeCompare(b.at);
      return c !== 0 ? c : a.content.localeCompare(b.content);
    });

  for (const inj of ordered) {
    const atMs = Date.parse(inj.at);
    if (Number.isNaN(atMs)) continue;
    const minAt = minInsertIndexAfterLeadingSystem(messages);
    let insertAt = minAt;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg) continue;
      const t = messageTimeMs(msg);
      if (t != null && t <= atMs) insertAt = Math.max(minAt, i + 1);
    }
    const manifest: AssistantMessage = {
      role: "assistant",
      name: TEMPORAL_SUMMARY_PEERS_ASSISTANT_NAME,
      content: wrapPeerRollupContent(inj.content),
      timestamp: inj.at,
    };
    messages.splice(insertAt, 0, manifest);
  }
}

export const TEMPORAL_PEERS_HEAD =
  "以下是同一时段内其他会话的客观时间摘要（合写）。仅作背景，勿当作本会话用户原话。";

export function wrapPeerRollupContent(summary: string): string {
  const body = summary.trim();
  if (!body) return "";
  return `${TEMPORAL_PEERS_HEAD}\n\n\`\`\`temporal\n${body}\n\`\`\``;
}

import type { ConversationMessage } from "@freeanima/kernel";

import { listMessages, listMessagesByIdRange } from "../repos/message-repo.js";

/** 蒸馏 / 压缩用：按 session 拉全量或 id 范围消息 */
export async function messagesForCompress(
  sessionId: string,
  opts?: { fromId?: number; toId?: number },
): Promise<ConversationMessage[]> {
  if (opts?.fromId != null) {
    return listMessagesByIdRange(sessionId, opts.fromId, opts.toId);
  }
  return listMessages(sessionId);
}

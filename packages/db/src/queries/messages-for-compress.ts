import type { ConversationMessage } from "@freeanima/legacy-kernel";

import { listMessages, listMessagesByPosRange } from "../repos/message-repo.js";

export async function messagesForCompress(
  sessionId: string,
  opts?: { fromPos?: number; toPos?: number },
): Promise<ConversationMessage[]> {
  if (opts?.fromPos != null) {
    return listMessagesByPosRange(sessionId, opts.fromPos, opts.toPos);
  }
  return listMessages(sessionId);
}

import type { ConversationMessage } from "@freeanima/core/db/domain";

import { listMessages, listMessagesByPosRange } from "../session/repos/message-repo.ts";

export async function messagesForCompress(
  sessionId: string,
  opts?: { fromPos?: number; toPos?: number },
): Promise<ConversationMessage[]> {
  if (opts?.fromPos != null) {
    return listMessagesByPosRange(sessionId, opts.fromPos, opts.toPos);
  }
  return listMessages(sessionId);
}

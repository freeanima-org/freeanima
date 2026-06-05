import type { ConversationMessage } from "@freeanima/kernel-schemas";

import { listMessages, listMessagesByPosRange } from "../repos/message-repo.ts";

export async function messagesForCompress(
  sessionId: string,
  opts?: { fromPos?: number; toPos?: number },
): Promise<ConversationMessage[]> {
  if (opts?.fromPos != null) {
    return listMessagesByPosRange(sessionId, opts.fromPos, opts.toPos);
  }
  return listMessages(sessionId);
}

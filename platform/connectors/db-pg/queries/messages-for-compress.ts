import type { ConversationMessage } from "@freeanima/core/db/domain";

import { listMessages, listMessagesByPosRange } from "../conversation/repos/message-repo.ts";

export async function messagesForCompress(
  conversationId: string,
  opts?: { fromPos?: number; toPos?: number },
): Promise<ConversationMessage[]> {
  if (opts?.fromPos != null) {
    return listMessagesByPosRange(conversationId, opts.fromPos, opts.toPos);
  }
  return listMessages(conversationId);
}

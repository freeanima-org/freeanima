import type { ConversationMessage } from "@freeanima/habitat/core/db/domain";

import { listMessages, listMessagesByPosRange } from "../conversation/repos/message-repo.ts";

export async function messagesForCompress(
  conversation_id: string,
  opts?: { fromPos?: number; toPos?: number },
): Promise<ConversationMessage[]> {
  if (opts?.fromPos != null) {
    return listMessagesByPosRange(conversation_id, opts.fromPos, opts.toPos);
  }
  return listMessages(conversation_id);
}

import { consoleCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getPromptDebug(conversationId?: string | null) {
  try {
    return await consoleCtx().getPromptDebug(conversationId);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Conversation not found")) {
      throw new ApiHandlerError(404, msg, { conversation_id: conversationId ?? undefined });
    }
    throw e;
  }
}

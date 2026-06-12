import { webuiCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getPromptDebug(sessionId?: string | null) {
  try {
    return await webuiCtx().getPromptDebug(sessionId);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Session not found")) {
      throw new ApiHandlerError(404, msg, { session_id: sessionId ?? undefined });
    }
    throw e;
  }
}

import { getServiceContext } from "@freeanima/service-api";
import { ApiHandlerError } from "./errors.ts";

export async function getPromptDebug(sessionId?: string | null) {
  const { service } = getServiceContext();
  try {
    return await service.getPromptDebug(sessionId);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Session not found")) {
      throw new ApiHandlerError(404, msg, { session_id: sessionId ?? undefined });
    }
    throw e;
  }
}

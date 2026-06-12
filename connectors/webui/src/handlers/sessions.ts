import { webuiCtx } from "./runtime.ts";
import { isSessionMeta } from "@freeanima/core/db/domain";
import { PARLOR_PLATFORM } from "../api/constants.ts";
import {
  createSessionBodySchema,
  patchTitleBodySchema,
  type CreateSessionBody,
  type PatchTitleBody,
} from "@freeanima/connectors-webui/api";
import { ApiHandlerError } from "./errors.ts";

export async function resolveSessionPlatform(sessionId: string): Promise<string> {
  const meta = await webuiCtx().conversation.loadSessionMeta(sessionId);
  const p = isSessionMeta(meta) ? meta.platform : undefined;
  return typeof p === "string" && p ? p : PARLOR_PLATFORM;
}

export async function listSessions(platform?: string) {
  const { sessions } = await webuiCtx().listSessions(platform);
  return { sessions };
}

export async function createSession(body: CreateSessionBody) {
  const parsed = createSessionBodySchema.parse(body);
  const platform = parsed.platform ?? PARLOR_PLATFORM;
  return webuiCtx().createSession(platform);
}

export async function getSessionInfo(sessionId: string) {
  try {
    return await webuiCtx().getSessionInfo(sessionId, await resolveSessionPlatform(sessionId));
  } catch (e) {
    throw new ApiHandlerError(404, String(e), { session_id: sessionId });
  }
}

export async function getSessionMessages(
  sessionId: string,
  opts?: { offset?: number; limit?: number },
) {
  try {
    return webuiCtx().getMessages(sessionId, await resolveSessionPlatform(sessionId), opts);
  } catch (e) {
    throw new ApiHandlerError(404, String(e), { session_id: sessionId });
  }
}

export async function setSessionTitle(sessionId: string, body: PatchTitleBody) {
  const { title } = patchTitleBodySchema.parse(body);
  try {
    return await webuiCtx().setSessionTitle(
      sessionId,
      title,
      await resolveSessionPlatform(sessionId),
    );
  } catch (e) {
    throw new ApiHandlerError(503, String(e), { session_id: sessionId });
  }
}

export function listCommands(opts: { platform?: string; all?: boolean }) {
  const all = opts.all === true;
  const platform = opts.platform ?? PARLOR_PLATFORM;
  return webuiCtx().listCommands({ platform, all });
}

export function getPlatforms() {
  return { ok: true as const, data: webuiCtx().getStatus().platforms };
}

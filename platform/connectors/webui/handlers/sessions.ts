import { webuiCtx } from "./runtime.ts";
import { isSessionMeta } from "@freeanima/core/db/domain";
import {
  createSessionBodySchema,
  patchTitleBodySchema,
  type CreateSessionBody,
  type PatchTitleBody,
} from "@freeanima/platform/connectors/webui/api";
import { ApiHandlerError } from "./errors.ts";

function requirePlatform(platform: string | undefined): string {
  const p = platform?.trim();
  if (!p) throw new ApiHandlerError(400, "platform is required");
  return p;
}

export async function resolveSessionPlatform(sessionId: string): Promise<string> {
  const meta = await webuiCtx().conversation.loadSessionMeta(sessionId);
  const p = isSessionMeta(meta) ? meta.platform : undefined;
  const platform = typeof p === "string" ? p.trim() : "";
  if (!platform) {
    throw new ApiHandlerError(400, `session ${sessionId} has no platform`);
  }
  return platform;
}

export async function listSessions(platform?: string) {
  const { sessions } = await webuiCtx().listSessions(platform);
  return { sessions };
}

export async function createSession(body: CreateSessionBody) {
  const parsed = createSessionBodySchema.parse(body);
  return webuiCtx().createSession(requirePlatform(parsed.platform));
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
    return await webuiCtx().getMessages(sessionId, await resolveSessionPlatform(sessionId), opts);
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
  if (all) return webuiCtx().listCommands({ all: true });
  return webuiCtx().listCommands({ platform: requirePlatform(opts.platform), all: false });
}

export function getPlatforms() {
  return { ok: true as const, data: webuiCtx().getStatus().platforms };
}

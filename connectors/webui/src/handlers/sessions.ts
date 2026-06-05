import { loadSessionMeta } from "@freeanima/engine-conversation";
import { isSessionMeta } from "@freeanima/kernel-schemas";
import { PARLOR_PLATFORM } from "../api/constants.ts";
import {
  createSessionBodySchema,
  patchTitleBodySchema,
  type CreateSessionBody,
  type PatchTitleBody,
} from "@freeanima/connectors-webui/api";
import { getServiceContext } from "@freeanima/service";
import { ApiHandlerError } from "./errors.ts";

export async function resolveSessionPlatform(sessionId: string): Promise<string> {
  const meta = await loadSessionMeta(sessionId);
  const p = isSessionMeta(meta) ? meta.platform : undefined;
  return typeof p === "string" && p ? p : PARLOR_PLATFORM;
}

export async function listSessions(platform?: string) {
  const { service } = getServiceContext();
  const { sessions } = await service.listSessions(platform);
  return { sessions };
}

export async function createSession(body: CreateSessionBody) {
  const parsed = createSessionBodySchema.parse(body);
  const { service } = getServiceContext();
  const platform = parsed.platform ?? PARLOR_PLATFORM;
  return service.createSession(platform);
}

export async function getSessionInfo(sessionId: string) {
  const { service } = getServiceContext();
  try {
    return await service.getSessionInfo(sessionId, await resolveSessionPlatform(sessionId));
  } catch (e) {
    throw new ApiHandlerError(404, String(e), { session_id: sessionId });
  }
}

export async function getSessionMessages(
  sessionId: string,
  opts?: { offset?: number; limit?: number },
) {
  const { service } = getServiceContext();
  try {
    return service.getMessages(sessionId, await resolveSessionPlatform(sessionId), opts);
  } catch (e) {
    throw new ApiHandlerError(404, String(e), { session_id: sessionId });
  }
}

export async function setSessionTitle(sessionId: string, body: PatchTitleBody) {
  const { title } = patchTitleBodySchema.parse(body);
  const { service } = getServiceContext();
  try {
    return await service.setSessionTitle(sessionId, title, await resolveSessionPlatform(sessionId));
  } catch (e) {
    throw new ApiHandlerError(503, String(e), { session_id: sessionId });
  }
}

export function listCommands(opts: { platform?: string; all?: boolean }) {
  const { service } = getServiceContext();
  const all = opts.all === true;
  const platform = opts.platform ?? PARLOR_PLATFORM;
  return service.listCommands({ platform, all });
}

export function getPlatforms() {
  const { service } = getServiceContext();
  return { ok: true as const, data: service.getStatus().platforms };
}

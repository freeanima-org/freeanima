import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import type { CommandResult } from "@freeanima/connectors-commands";
import type { MessagesDisplay } from "@freeanima/service/schemas/display";
import type { SessionSummary } from "@freeanima/service/schemas/snapshot";
import { getServiceContext } from "../context.ts";
import { buildMessagesDisplay } from "./build-messages-display.ts";
import { statsReport } from "./conversation-stats.ts";
import { PARLOR_PLATFORM } from "./platforms.ts";

function conv() {
  return getServiceContext().conversation;
}

export async function checkPlatform(params: { platform?: string }, sid: string): Promise<void> {
  const platform = (params.platform ?? "").trim();
  if (platform) await conv().assertSessionPlatform(sid, platform);
}

export async function listSessions(
  platform?: string | null,
): Promise<{ sessions: SessionSummary[] }> {
  const p = platform === "" ? null : platform;
  return { sessions: await conv().listSessionSummaries(p ?? undefined) };
}

export async function createSession(platform = PARLOR_PLATFORM): Promise<{ session_id: string }> {
  const sid = await conv().newSession(platform);
  return { session_id: sid };
}

export async function findOrCreateSession(
  platform: string,
  platform_extra: Record<string, unknown> = {},
): Promise<{ session_id: string }> {
  let sid = await conv().findSessionByOrigin(platform, platform_extra);
  if (!sid) {
    sid = await conv().newSession(platform, undefined, platform_extra);
  } else {
    await conv().refreshSystemPromptOnResume(sid);
  }
  return { session_id: sid };
}

export async function patchSessionOrigin(
  session_id: string,
  platform: string,
  platform_extra?: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  await conv().patchSessionOrigin(session_id, platform, platform_extra);
  return { ok: true };
}

export async function applyCommandSessionEffects(
  result: CommandResult,
  _sessionId: string,
  platform: string,
  originExtra?: Record<string, unknown>,
): Promise<void> {
  const data = result.data as { new_session_id?: string } | undefined;
  if (data?.new_session_id && originExtra !== undefined) {
    await conv().patchSessionOrigin(data.new_session_id, platform, originExtra);
  }
}

export async function getSessionInfo(
  sessionId: string,
  platform = "",
): Promise<Record<string, unknown>> {
  if (!(await conv().sessionExists(sessionId))) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  await checkPlatform({ platform }, sessionId);
  return { session_id: sessionId, stats: await statsReport(sessionId) };
}

export async function getMessages(
  sessionId: string,
  platform = "",
  opts?: { offset?: number; limit?: number | null },
): Promise<MessagesDisplay> {
  if (!(await conv().sessionExists(sessionId))) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  await checkPlatform({ platform }, sessionId);
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.max(1, opts?.limit ?? 500);
  const [total, page] = await Promise.all([
    conv().countMessages(sessionId),
    conv().loadMessagePage(sessionId, offset, limit),
  ]);
  const full = buildMessagesDisplay(page);
  return {
    session_id: sessionId,
    display: full,
    total,
    offset,
    limit,
  };
}

export async function setSessionTitle(
  sessionId: string,
  title: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform({ platform }, sessionId);
  await conv().setSessionTitle(sessionId, title.slice(0, 50));
  return { ok: true };
}

export async function appendSessionMetaForEngine(session: string): Promise<void> {
  const cfg = loadConfig();
  const names = getServiceContext().engine.catalog.toolSets.toolNames();
  await conv().appendSessionMeta(session, names, getProfileHopModel(cfg, PROFILE_CHAT), {});
}

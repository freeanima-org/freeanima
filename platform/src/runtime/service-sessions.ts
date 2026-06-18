import { resolveDefaultSessionToolSets } from "@freeanima/core/tool";
import { getProfileHopModel } from "@freeanima/platform/config";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import type { CommandResult } from "@freeanima/platform/commands";
import type { MessagesDisplay } from "@freeanima/platform/schemas/display";
import type { SessionSummary } from "@freeanima/platform/schemas/snapshot";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { buildMessagesDisplay } from "./build-messages-display.ts";
import { statsReport } from "./conversation-stats.ts";
import { originLockKey, runExclusiveOrigin } from "./origin-lock.ts";
import { PARLOR_PLATFORM } from "./platforms.ts";

export async function checkPlatform(
  deps: RuntimeDeps,
  params: { platform?: string },
  sid: string,
): Promise<void> {
  const platform = (params.platform ?? "").trim();
  if (platform) await deps.conversation.assertSessionPlatform(sid, platform);
}

export async function listSessions(
  deps: RuntimeDeps,
  platform?: string | null,
): Promise<{ sessions: SessionSummary[] }> {
  const p = platform === "" ? null : platform;
  return { sessions: await deps.conversation.listSessionSummaries(p ?? undefined) };
}

export async function createSession(
  deps: RuntimeDeps,
  platform = PARLOR_PLATFORM,
): Promise<{ session_id: string }> {
  const sid = await deps.conversation.newSession(platform);
  return { session_id: sid };
}

export async function findOrCreateSession(
  deps: RuntimeDeps,
  platform: string,
  platform_extra: Record<string, unknown> = {},
): Promise<{ session_id: string }> {
  const key = originLockKey(platform, platform_extra);
  return runExclusiveOrigin(key, async () => {
    let sid = await deps.conversation.findSessionByOrigin(platform, platform_extra);
    if (!sid) {
      sid = await deps.conversation.newSession(platform, undefined, platform_extra);
      await deps.conversation.activateSessionOrigin(sid);
    } else {
      await deps.conversation.refreshSystemPromptOnResume(sid);
    }
    return { session_id: sid };
  });
}

export async function patchSessionOrigin(
  deps: RuntimeDeps,
  session_id: string,
  platform: string,
  platform_extra?: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  await deps.conversation.patchSessionOrigin(session_id, platform, platform_extra);
  return { ok: true };
}

export async function applyCommandSessionEffects(
  deps: RuntimeDeps,
  result: CommandResult,
  _sessionId: string,
  platform: string,
  originExtra?: Record<string, unknown>,
): Promise<void> {
  const data = result.data as { new_session_id?: string } | undefined;
  if (data?.new_session_id && originExtra !== undefined) {
    await deps.conversation.patchSessionOrigin(data.new_session_id, platform, originExtra);
    await deps.conversation.activateSessionOrigin(data.new_session_id);
  }
}

export async function getSessionInfo(
  deps: RuntimeDeps,
  sessionId: string,
  platform = "",
): Promise<Record<string, unknown>> {
  if (!(await deps.conversation.sessionExists(sessionId))) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  await checkPlatform(deps, { platform }, sessionId);
  return { session_id: sessionId, stats: await statsReport(deps, sessionId) };
}

export async function getMessages(
  deps: RuntimeDeps,
  sessionId: string,
  platform = "",
  opts?: { offset?: number; limit?: number | null },
): Promise<MessagesDisplay> {
  if (!(await deps.conversation.sessionExists(sessionId))) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  await checkPlatform(deps, { platform }, sessionId);
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.max(1, opts?.limit ?? 500);
  const [total, page] = await Promise.all([
    deps.conversation.countMessages(sessionId),
    deps.conversation.loadMessagePage(sessionId, offset, limit),
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
  deps: RuntimeDeps,
  sessionId: string,
  title: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, sessionId);
  await deps.conversation.setSessionTitle(sessionId, title.slice(0, 50));
  return { ok: true };
}

export async function appendSessionMetaForEngine(
  deps: RuntimeDeps,
  session: string,
): Promise<void> {
  const cfg = deps.engine.config.data;
  const toolSets = deps.engine.catalog.toolSets;
  const names = resolveDefaultSessionToolSets(toolSets);
  await deps.conversation.appendSessionMeta(
    session,
    names,
    getProfileHopModel(cfg, PROFILE_CHAT),
    {},
  );
}

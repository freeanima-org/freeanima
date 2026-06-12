import type { PgRepositories } from "@freeanima/core/repos";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import type { SessionMessage } from "@freeanima/runtime/session";
import {
  advanceCompressionMeta,
  appendMessage,
  appendSessionMeta,
  appendUserTurn,
  assertSessionPlatform,
  beginTurn,
  beginTurnFast,
  beginTurnPrepare,
  buildRuntimeMessages,
  cleanupDebugSessions,
  countMessages,
  countSessionsByPlatform,
  findSessionByOrigin,
  finishTurn,
  getSessionCwd,
  getSessionTitle,
  initSession,
  load,
  loadForRuntime,
  loadMessagePage,
  loadSessionMeta,
  loadSessionTools,
  listSessionSummaries,
  listSessions,
  maybeApplyEmergencyCompression,
  newSession,
  patchSessionOrigin,
  rebuildSessionSystemPrompt,
  refreshSystemPromptOnResume,
  reloadSessionTools,
  repairAndPersistToolLoop,
  recompressSession,
  retryTurn,
  rollbackToLastUser,
  sessionExists,
  setSessionCwd,
  setSessionTitle,
  updateSessionMeta,
  updateSessionMetaField,
} from "./conversation.ts";

function bindRepos<A extends unknown[], T>(
  repos: PgRepositories,
  fn: (repos: PgRepositories, ...args: A) => T,
): (...args: A) => T {
  return (...args: A) => fn(repos, ...args);
}

function bindReposAndTools<A extends unknown[], T>(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  fn: (repos: PgRepositories, tools: ToolSetRegistry, ...args: A) => T,
): (...args: A) => T {
  return (...args: A) => fn(repos, tools, ...args);
}

/** Bound session/turn API for composition root */
export function createConversationService(repos: PgRepositories, tools: ToolSetRegistry) {
  return {
    repos,
    tools,
    loadSessionTools: bindReposAndTools(repos, tools, loadSessionTools),
    loadSessionMeta: bindRepos(repos, loadSessionMeta),
    countSessionsByPlatform: bindRepos(repos, countSessionsByPlatform),
    listSessionSummaries: bindRepos(repos, listSessionSummaries),
    listSessions: bindRepos(repos, listSessions),
    sessionExists: bindRepos(repos, sessionExists),
    load: bindRepos(repos, load),
    loadMessagePage: bindRepos(repos, loadMessagePage),
    countMessages: bindRepos(repos, countMessages),
    loadForRuntime: bindRepos(repos, loadForRuntime),
    appendMessage: (msg: SessionMessage, session: string) => appendMessage(repos, msg, session),
    appendSessionMeta: bindRepos(repos, appendSessionMeta),
    initSession: bindReposAndTools(repos, tools, initSession),
    newSession: bindReposAndTools(repos, tools, newSession),
    findSessionByOrigin: bindRepos(repos, findSessionByOrigin),
    updateSessionMetaField: (
      session: string,
      patch: Parameters<typeof updateSessionMetaField>[2],
    ) => updateSessionMetaField(repos, session, patch),
    patchSessionOrigin: bindRepos(repos, patchSessionOrigin),
    rebuildSessionSystemPrompt: bindRepos(repos, rebuildSessionSystemPrompt),
    reloadSessionTools: bindReposAndTools(repos, tools, reloadSessionTools),
    refreshSystemPromptOnResume: bindRepos(repos, refreshSystemPromptOnResume),
    assertSessionPlatform: bindRepos(repos, assertSessionPlatform),
    appendUserTurn: bindRepos(repos, appendUserTurn),
    advanceCompressionMeta: bindReposAndTools(repos, tools, advanceCompressionMeta),
    recompressSession: bindReposAndTools(repos, tools, recompressSession),
    repairAndPersistToolLoop: bindRepos(repos, repairAndPersistToolLoop),
    maybeApplyEmergencyCompression: bindRepos(repos, maybeApplyEmergencyCompression),
    buildRuntimeMessages: bindReposAndTools(repos, tools, buildRuntimeMessages),
    beginTurn: bindReposAndTools(repos, tools, beginTurn),
    beginTurnFast: bindRepos(repos, beginTurnFast),
    beginTurnPrepare: bindReposAndTools(repos, tools, beginTurnPrepare),
    finishTurn: bindReposAndTools(repos, tools, finishTurn),
    updateSessionMeta: bindReposAndTools(repos, tools, updateSessionMeta),
    setSessionTitle: bindRepos(repos, setSessionTitle),
    getSessionTitle: bindRepos(repos, getSessionTitle),
    getSessionCwd: bindRepos(repos, getSessionCwd),
    setSessionCwd: bindRepos(repos, setSessionCwd),
    rollbackToLastUser: bindRepos(repos, rollbackToLastUser),
    retryTurn: bindReposAndTools(repos, tools, retryTurn),
    cleanupDebugSessions: bindRepos(repos, cleanupDebugSessions),
  };
}

export type ConversationService = ReturnType<typeof createConversationService>;

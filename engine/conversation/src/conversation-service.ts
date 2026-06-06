import type { PgRepositories } from "@freeanima/engine-repos";
import type { SessionMessage } from "@freeanima/engine-conversation";
import {
  advanceCompressionMeta,
  appendMessage,
  appendSessionMeta,
  appendUserTurn,
  assertSessionPlatform,
  beginTurn,
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

/** 绑定 PgRepositories 的对话 API；由 service 组合根实例化 */
export class ConversationService {
  readonly repos: PgRepositories;

  readonly loadSessionTools;
  readonly loadSessionMeta;
  readonly countSessionsByPlatform;
  readonly listSessionSummaries;
  readonly listSessions;
  readonly sessionExists;
  readonly load;
  readonly loadMessagePage;
  readonly countMessages;
  readonly loadForRuntime;
  readonly appendMessage;
  readonly appendSessionMeta;
  readonly initSession;
  readonly newSession;
  readonly findSessionByOrigin;
  readonly updateSessionMetaField;
  readonly patchSessionOrigin;
  readonly rebuildSessionSystemPrompt;
  readonly reloadSessionTools;
  readonly refreshSystemPromptOnResume;
  readonly assertSessionPlatform;
  readonly appendUserTurn;
  readonly advanceCompressionMeta;
  readonly recompressSession;
  readonly repairAndPersistToolLoop;
  readonly maybeApplyEmergencyCompression;
  readonly buildRuntimeMessages;
  readonly beginTurn;
  readonly finishTurn;
  readonly updateSessionMeta;
  readonly setSessionTitle;
  readonly getSessionTitle;
  readonly getSessionCwd;
  readonly setSessionCwd;
  readonly rollbackToLastUser;
  readonly retryTurn;
  readonly cleanupDebugSessions;

  constructor(repos: PgRepositories) {
    this.repos = repos;
    this.loadSessionTools = bindRepos(repos, loadSessionTools);
    this.loadSessionMeta = bindRepos(repos, loadSessionMeta);
    this.countSessionsByPlatform = bindRepos(repos, countSessionsByPlatform);
    this.listSessionSummaries = bindRepos(repos, listSessionSummaries);
    this.listSessions = bindRepos(repos, listSessions);
    this.sessionExists = bindRepos(repos, sessionExists);
    this.load = bindRepos(repos, load);
    this.loadMessagePage = bindRepos(repos, loadMessagePage);
    this.countMessages = bindRepos(repos, countMessages);
    this.loadForRuntime = bindRepos(repos, loadForRuntime);
    this.appendMessage = (msg: SessionMessage, session: string) =>
      appendMessage(repos, msg, session);
    this.appendSessionMeta = bindRepos(repos, appendSessionMeta);
    this.initSession = bindRepos(repos, initSession);
    this.newSession = bindRepos(repos, newSession);
    this.findSessionByOrigin = bindRepos(repos, findSessionByOrigin);
    this.updateSessionMetaField = (
      session: string,
      patch: Parameters<typeof updateSessionMetaField>[2],
    ) => updateSessionMetaField(repos, session, patch);
    this.patchSessionOrigin = bindRepos(repos, patchSessionOrigin);
    this.rebuildSessionSystemPrompt = bindRepos(repos, rebuildSessionSystemPrompt);
    this.reloadSessionTools = bindRepos(repos, reloadSessionTools);
    this.refreshSystemPromptOnResume = bindRepos(repos, refreshSystemPromptOnResume);
    this.assertSessionPlatform = bindRepos(repos, assertSessionPlatform);
    this.appendUserTurn = bindRepos(repos, appendUserTurn);
    this.advanceCompressionMeta = bindRepos(repos, advanceCompressionMeta);
    this.recompressSession = bindRepos(repos, recompressSession);
    this.repairAndPersistToolLoop = bindRepos(repos, repairAndPersistToolLoop);
    this.maybeApplyEmergencyCompression = bindRepos(repos, maybeApplyEmergencyCompression);
    this.buildRuntimeMessages = bindRepos(repos, buildRuntimeMessages);
    this.beginTurn = bindRepos(repos, beginTurn);
    this.finishTurn = bindRepos(repos, finishTurn);
    this.updateSessionMeta = bindRepos(repos, updateSessionMeta);
    this.setSessionTitle = bindRepos(repos, setSessionTitle);
    this.getSessionTitle = bindRepos(repos, getSessionTitle);
    this.getSessionCwd = bindRepos(repos, getSessionCwd);
    this.setSessionCwd = bindRepos(repos, setSessionCwd);
    this.rollbackToLastUser = bindRepos(repos, rollbackToLastUser);
    this.retryTurn = bindRepos(repos, retryTurn);
    this.cleanupDebugSessions = bindRepos(repos, cleanupDebugSessions);
  }
}

export function createConversationService(repos: PgRepositories): ConversationService {
  return new ConversationService(repos);
}

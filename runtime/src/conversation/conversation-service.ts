import type { PgRepositories } from "@freeanima/core/repos";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import type { StoredMessage } from "@freeanima/core/db/domain";
import {
  appendMessage,
  appendConversationMeta,
  appendUserTurn,
  assertConversationPlatform,
  cleanupDebugConversations,
  countMessages,
  countUserMessages,
  countConversationsByPlatform,
  findConversationByOrigin,
  activateConversationOrigin,
  getConversationCwd,
  getConversationTitle,
  initConversation,
  load,
  loadForRuntime,
  loadMessagePage,
  loadConversationMeta,
  loadConversationTools,
  listConversationSummaries,
  listConversationSummariesPage,
  listConversations,
  newConversation,
  patchConversationOrigin,
  rebuildConversationSystemPrompt,
  refreshSystemPromptOnResume,
  rebuildConversationCache,
  rollbackToLastUser,
  conversationExists,
  setConversationCwd,
  setConversationTitle,
  archiveConversation,
  unarchiveConversation,
  deleteUserConversation,
  updateConversationMeta,
  updateConversationMetaField,
} from "./conversation.ts";
import {
  advanceCompressionMeta,
  maybeApplyEmergencyCompression,
  recompressConversation,
} from "../turn/compression-orchestration.ts";
import {
  beginTurn,
  beginTurnFast,
  beginTurnPrepare,
  buildRuntimeMessages,
  finishTurn,
  repairAndPersistToolLoop,
  retryTurn,
} from "../turn/turn-runtime.ts";

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

/** Bound conversation/turn API for composition root */
export function createConversationService(repos: PgRepositories, tools: ToolSetRegistry) {
  return {
    repos,
    tools,
    loadConversationTools: bindReposAndTools(repos, tools, loadConversationTools),
    loadConversationMeta: bindRepos(repos, loadConversationMeta),
    countConversationsByPlatform: bindRepos(repos, countConversationsByPlatform),
    listConversationSummaries: bindRepos(repos, listConversationSummaries),
    listConversationSummariesPage: bindRepos(repos, listConversationSummariesPage),
    listConversations: bindRepos(repos, listConversations),
    conversationExists: bindRepos(repos, conversationExists),
    load: bindRepos(repos, load),
    loadMessagePage: bindRepos(repos, loadMessagePage),
    countMessages: bindRepos(repos, countMessages),
    countUserMessages: bindRepos(repos, countUserMessages),
    loadForRuntime: bindRepos(repos, loadForRuntime),
    appendMessage: (msg: StoredMessage, conversation: string) =>
      appendMessage(repos, msg, conversation),
    appendConversationMeta: bindRepos(repos, appendConversationMeta),
    initConversation: bindReposAndTools(repos, tools, initConversation),
    newConversation: bindReposAndTools(repos, tools, newConversation),
    findConversationByOrigin: bindRepos(repos, findConversationByOrigin),
    activateConversationOrigin: bindRepos(repos, activateConversationOrigin),
    updateConversationMetaField: (
      conversationId: string,
      patch: Parameters<typeof updateConversationMetaField>[2],
    ) => updateConversationMetaField(repos, conversationId, patch),
    patchConversationOrigin: bindRepos(repos, patchConversationOrigin),
    rebuildConversationSystemPrompt: bindRepos(repos, rebuildConversationSystemPrompt),
    rebuildConversationCache: bindReposAndTools(repos, tools, rebuildConversationCache),
    refreshSystemPromptOnResume: bindRepos(repos, refreshSystemPromptOnResume),
    assertConversationPlatform: bindRepos(repos, assertConversationPlatform),
    appendUserTurn: bindRepos(repos, appendUserTurn),
    advanceCompressionMeta: bindReposAndTools(repos, tools, advanceCompressionMeta),
    recompressConversation: bindReposAndTools(repos, tools, recompressConversation),
    repairAndPersistToolLoop: bindRepos(repos, repairAndPersistToolLoop),
    maybeApplyEmergencyCompression: bindRepos(repos, maybeApplyEmergencyCompression),
    buildRuntimeMessages: bindReposAndTools(repos, tools, buildRuntimeMessages),
    beginTurn: bindReposAndTools(repos, tools, beginTurn),
    beginTurnFast: bindRepos(repos, beginTurnFast),
    beginTurnPrepare: bindReposAndTools(repos, tools, beginTurnPrepare),
    finishTurn: bindReposAndTools(repos, tools, finishTurn),
    updateConversationMeta: bindReposAndTools(repos, tools, updateConversationMeta),
    setConversationTitle: bindRepos(repos, setConversationTitle),
    archiveConversation: bindRepos(repos, archiveConversation),
    unarchiveConversation: bindRepos(repos, unarchiveConversation),
    deleteUserConversation: bindRepos(repos, deleteUserConversation),
    getConversationTitle: bindRepos(repos, getConversationTitle),
    getConversationCwd: bindRepos(repos, getConversationCwd),
    setConversationCwd: bindRepos(repos, setConversationCwd),
    rollbackToLastUser: bindRepos(repos, rollbackToLastUser),
    retryTurn: bindReposAndTools(repos, tools, retryTurn),
    cleanupDebugConversations: bindRepos(repos, cleanupDebugConversations),
  };
}

export type ConversationService = ReturnType<typeof createConversationService>;

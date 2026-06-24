/**
 * One-shot Session → Conversation rename. Run from repo root:
 * bun scripts/rename-session-to-conversation.ts
 */
import { readdir, readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const SKIP_DIRS = new Set(["node_modules", ".tsout", "dist", ".git", "www", ".generated"]);

const SKIP_FILES = new Set(["scripts/rename-session-to-conversation.ts"]);

/** Longer / more specific replacements first */
const REPLACEMENTS: Array<[string, string]> = [
  // Tool context
  ["getToolSessionId", "getToolConversationId"],
  ['ToolContextKind = "session"', 'ToolContextKind = "conversation"'],
  ['contextKind: "session"', 'contextKind: "conversation"'],
  ['contextKind ?? "session"', 'contextKind ?? "conversation"'],
  ["'session' | 'auto_llm'", "'conversation' | 'auto_llm'"],
  ['"session" | "auto_llm"', '"conversation" | "auto_llm"'],

  // Ports & stores
  ["SessionStorePort", "ConversationStorePort"],
  ["nullSessionStore", "nullConversationStore"],
  ["null-session.ts", "null-conversation.ts"],
  ["pg-session-store.ts", "pg-conversation-store.ts"],
  ["pgSessionStore", "pgConversationStore"],
  ["SessionSummaryRow", "ConversationSummaryRow"],
  ["SessionCleanupResult", "ConversationCleanupResult"],
  ["LimbicListBySessionsOpts", "LimbicListByConversationsOpts"],
  ["limbic-by-sessions-repo.ts", "limbic-by-conversations-repo.ts"],
  ["limbic-by-sessions", "limbic-by-conversations"],

  // Domain types
  ["SessionMetaLoadResult", "ConversationMetaLoadResult"],
  ["SessionMetaMessage", "ConversationMetaMessage"],
  ["SessionTodoStore", "ConversationTodoStore"],
  ["SessionGoal", "ConversationGoal"],
  ["parseSessionGoal", "parseConversationGoal"],
  ["parseSessionTodoStore", "parseConversationTodoStore"],
  ["sessionMetaSchema", "conversationMetaSchema"],
  ["sessionMessageSchema", "storedMessageSchema"],
  ["isSessionMeta", "isConversationMeta"],
  ["SessionMessage", "StoredMessage"],
  ["SessionTodosJson", "ConversationTodosJson"],
  ["SessionCachedToolsetsJson", "ConversationCachedToolsetsJson"],
  ["SessionStagedToolsetsJson", "ConversationStagedToolsetsJson"],
  ["SessionFunctionsJson", "ConversationFunctionsJson"],
  ["SessionGoalJson", "ConversationGoalJson"],
  ["SessionGoalStatusJson", "ConversationGoalStatusJson"],
  ["SessionSelect", "ConversationSelect"],
  ["SessionInsert", "ConversationInsert"],
  ["sessionSelectSchema", "conversationSelectSchema"],
  ["sessionInsertSchema", "conversationInsertSchema"],
  ["sessionJsonbRefine", "conversationJsonbRefine"],
  ["sessionTodoStoreSchema", "conversationTodoStoreSchema"],
  ["sessionCachedToolsetsSchema", "conversationCachedToolsetsSchema"],
  ["sessionStagedToolsetsSchema", "conversationStagedToolsetsSchema"],
  ["sessionFunctionsSchema", "conversationFunctionsSchema"],
  ["sessionGoalSchema", "conversationGoalSchema"],
  ["sessionGoalStatusSchema", "conversationGoalStatusSchema"],
  ["normalizeSessionToolNames", "normalizeConversationToolNames"],
  ["session-jsonb.ts", "conversation-jsonb.ts"],
  ["session-meta-jsonb.ts", "conversation-meta-jsonb.ts"],

  // Schema table
  ['from "./sessions.ts"', 'from "./conversations.ts"'],
  ["from './sessions.ts'", "from './conversations.ts'"],
  ["sessions.ts", "conversations.ts"],
  ["export const sessions =", "export const conversations ="],
  ['pgTable("sessions"', 'pgTable("conversations"'],
  ["r.sessions.", "r.conversations."],
  ["r.one.sessions", "r.one.conversations"],
  ["sessions,", "conversations,"],
  ["{ sessions,", "{ conversations,"],
  ["sessions.id", "conversations.id"],
  ["() => sessions.id", "() => conversations.id"],

  // JSONB imports in conversations.ts
  ["SessionCachedToolsetsJson", "ConversationCachedToolsetsJson"],
  ["SessionFunctionsJson", "ConversationFunctionsJson"],
  ["SessionGoalJson", "ConversationGoalJson"],
  ["SessionStagedToolsetsJson", "ConversationStagedToolsetsJson"],
  ["SessionTodosJson", "ConversationTodosJson"],
  ["session-jsonb.ts", "conversation-jsonb.ts"],

  // Columns
  ["messages_session_id_pos_uidx", "messages_conversation_id_pos_uidx"],
  ["idx_limbic_memory_session_id", "idx_limbic_memory_conversation_id"],
  ["idx_memory_references_session_id", "idx_memory_references_conversation_id"],
  ["idx_semantic_memory_source_sessions", "idx_semantic_memory_source_conversations"],
  [
    "idx_autobiographical_memory_source_sessions",
    "idx_autobiographical_memory_source_conversations",
  ],
  ["tasks_source_session_id_sessions_id_fk", "tasks_source_conversation_id_conversations_id_fk"],
  ["sourceSessionIds", "sourceConversationIds"],
  ["source_session_ids", "source_conversation_ids"],
  ["sourceSessions", "sourceConversations"],
  ["source_sessions", "source_conversations"],
  ["sourceSessionId", "sourceConversationId"],
  ["source_session_id", "source_conversation_id"],
  ["sessionId", "conversationId"],
  ["session_id", "conversation_id"],
  ["session_mood", "conversation_mood"],
  ["session_meta", "conversation_meta"],

  // PgRepositories
  ["repos.session", "repos.conversation"],
  ["session: SessionStorePort", "conversation: ConversationStorePort"],
  ["session: nullSessionStore", "conversation: nullConversationStore"],
  ["conversationStore:", "conversationStore:"],
  ["stores.session", "stores.conversation"],
  ["stores.conversationStore", "stores.conversationStore"],

  // Runtime / service functions
  ["onSessionCloseBeforeNew", "onConversationCloseBeforeNew"],
  ["registerMemorySessionStore", "registerMemoryConversationStore"],
  ["getMemorySessionStore", "getMemoryConversationStore"],
  ["resetMemorySessionStoreForTests", "resetMemoryConversationStoreForTests"],
  ["registerSessionTools", "registerConversationTools"],
  ["requireSessionStore", "requireConversationStore"],
  ["createMockSessionStore", "createMockConversationStore"],
  ["mockSessionStore", "mockConversationStore"],
  ["purgeCronSessions", "purgeCronConversations"],
  ["PurgeCronSessionsResult", "PurgeCronConversationsResult"],
  ["cleanupStaleSessions", "cleanupStaleConversations"],
  ["cleanupDebugSessions", "cleanupDebugConversations"],
  ["deleteDebugSessions", "deleteDebugConversations"],
  ["deleteStaleSessions", "deleteStaleConversations"],
  ["listStaleSessionIdsForCleanup", "listStaleConversationIdsForCleanup"],
  ["listSessionIdsUpdatedBetween", "listConversationIdsUpdatedBetween"],
  ["listSessionIdsMatchingPlatformProbe", "listConversationIdsMatchingPlatformProbe"],
  ["findSessionIdByPlatformInfo", "findConversationIdByPlatformInfo"],
  ["getEarliestSessionDay", "getEarliestConversationDay"],
  ["countSessionsByPlatform", "countConversationsByPlatform"],
  ["listSessionSummariesPage", "listConversationSummariesPage"],
  ["listSessionSummaries", "listConversationSummaries"],
  ["listSessionIds", "listConversationIds"],
  ["listBySessions", "listByConversations"],
  ["loadSessionTools", "loadConversationTools"],
  ["loadSessionMeta", "loadConversationMeta"],
  ["getSessionMetaLite", "getConversationMetaLite"],
  ["getSessionMeta", "getConversationMeta"],
  ["upsertSessionMeta", "upsertConversationMeta"],
  ["patchSessionMeta", "patchConversationMeta"],
  ["appendSessionMeta", "appendConversationMeta"],
  ["updateSessionMetaField", "updateConversationMetaField"],
  ["updateSessionMeta", "updateConversationMeta"],
  ["rebuildSessionSystemPrompt", "rebuildConversationSystemPrompt"],
  ["rebuildSessionCache", "rebuildConversationCache"],
  ["assertSessionPlatform", "assertConversationPlatform"],
  ["findSessionByOrigin", "findConversationByOrigin"],
  ["activateSessionOrigin", "activateConversationOrigin"],
  ["patchSessionOrigin", "patchConversationOrigin"],
  ["recompressSession", "recompressConversation"],
  ["setSessionTitle", "setConversationTitle"],
  ["getSessionTitle", "getConversationTitle"],
  ["setSessionCwd", "setConversationCwd"],
  ["getSessionCwd", "getConversationCwd"],
  ["initSession", "initConversation"],
  ["newSession", "newConversation"],
  ["deleteSession", "deleteConversation"],
  ["sessionExists", "conversationExists"],
  ["loadSessionToolsWithRouting", "loadConversationToolsWithRouting"],
  ["applySessionToolMaskFilter", "applyConversationToolMaskFilter"],
  ["resolveDefaultSessionToolSetsForMeta", "resolveDefaultConversationToolSetsForMeta"],
  ["resolveDefaultSessionToolSets", "resolveDefaultConversationToolSets"],
  ["DEFAULT_SESSION_TOOLSETS", "DEFAULT_CONVERSATION_TOOLSETS"],
  ["default-session-toolsets.ts", "default-conversation-toolsets.ts"],
  ["session-conversation-port.ts", "conversation-port.ts"],
  ["session-tools.ts", "conversation-tools.ts"],
  ["session-todos.ts", "conversation-todos.ts"],
  ["session-handoff.ts", "conversation-handoff.ts"],
  ["session-crud.ts", "conversation-crud.ts"],
  ["session-store-pg-bridge.ts", "conversation-store-pg-bridge.ts"],
  ["session-repo.ts", "conversation-repo.ts"],
  ["session-mapper.ts", "conversation-mapper.ts"],
  ["session-port.ts", "conversation-port.ts"],
  ["tool-conversation-port.ts", "tool-conversation-port.ts"],
  ["session-title.ts", "conversation-title.ts"],
  ["session-manager.ts", "conversation-manager.ts"],
  ["session-close.ts", "conversation-close.ts"],
  ["acp-session-callback.ts", "acp-conversation-callback.ts"],
  ["service-sessions.ts", "service-conversations.ts"],
  ["session-events.ts", "conversation-events.ts"],
  ["session-fixtures.ts", "conversation-fixtures.ts"],
  ["session-size.sql", "conversation-size.sql"],
  ["setSessionGoal", "setConversationGoal"],
  ["readSessionGoal", "readConversationGoal"],
  ["pauseSessionGoal", "pauseConversationGoal"],
  ["resumeSessionGoal", "resumeConversationGoal"],
  ["collectSessionBlocks", "collectConversationBlocks"],
  ["formatSessionMessageSearchHit", "formatConversationMessageSearchHit"],
  ["formatSessionIdDateTime", "formatConversationIdDateTime"],
  ["sessionLabel", "conversationLabel"],
  ["subscribeSessionEvents", "subscribeConversationEvents"],
  ["sapPatchSessionTitle", "sapPatchConversationTitle"],
  ["sapListSessions", "sapListConversations"],
  ["sapCreateSession", "sapCreateConversation"],
  ["sapGetSessionMessages", "sapGetConversationMessages"],
  ["createSapSessionStreamClient", "createSapConversationStreamClient"],
  ["session-stream-core.ts", "conversation-stream-core.ts"],
  ["notifySession", "notifyConversation"],
  ["sessionListeners", "conversationListeners"],
  ["sessionUpdatedOff", "conversationUpdatedOff"],
  ["subscribedSessions", "subscribedConversations"],
  ["SessionCreateInput", "ConversationCreateInput"],
  ["SessionListInput", "ConversationListInput"],
  ["SessionMessagesInput", "ConversationMessagesInput"],
  ["SessionPatchTitleInput", "ConversationPatchTitleInput"],
  ["SessionSubscribeInput", "ConversationSubscribeInput"],
  ["SessionAcpDockInput", "ConversationAcpDockInput"],
  ["SessionCommandsInput", "ConversationCommandsInput"],
  ["SessionCreateOutput", "ConversationCreateOutput"],
  ["SessionListOutput", "ConversationListOutput"],
  ["SessionAcpDockOutput", "ConversationAcpDockOutput"],
  ["SessionCommandsOutput", "ConversationCommandsOutput"],
  ["sessionCreateInputSchema", "conversationCreateInputSchema"],
  ["sessionListInputSchema", "conversationListInputSchema"],
  ["sessionMessagesInputSchema", "conversationMessagesInputSchema"],
  ["sessionPatchTitleInputSchema", "conversationPatchTitleInputSchema"],
  ["sessionSubscribeInputSchema", "conversationSubscribeInputSchema"],
  ["sessionSummarySchema", "conversationSummarySchema"],
  ["sessionListOutputSchema", "conversationListOutputSchema"],
  ["SessionSummary", "ConversationSummary"],
  ["frames/session.ts", "frames/conversation.ts"],
  ["getSessionInfo", "getConversationInfo"],
  ["getSessionMessages", "getConversationMessages"],
  ["listSessions", "listConversations"],
  ["chamber-sessions.ts", "chamber-conversations.ts"],
  ["SessionMessagePanel", "ConversationMessagePanel"],
  ["SessionListItem", "ConversationListItem"],
  ["SessionPanel", "ConversationPanel"],
  ["clarify-session.test.ts", "clarify-conversation.test.ts"],
  ["db-session.test.ts", "db-conversation.test.ts"],
  ["session-cleanup.test.ts", "conversation-cleanup.test.ts"],
  ["session.test.ts", "conversation.test.ts"],
  ["session-tools.test.ts", "conversation-tools.test.ts"],
  ["session-handoff.test.ts", "conversation-handoff.test.ts"],
  ["session-title.test.ts", "conversation-title.test.ts"],
  ["on-session-close.ts", "on-conversation-close.ts"],
  ["sessionCleanup", "conversationCleanup"],
  ["session-cleanup", "conversation-cleanup"],
  ["anima-session-cleanup-", "anima-conversation-cleanup-"],

  // SAP methods & events
  ['"session.create"', '"conversation.create"'],
  ['"session.list"', '"conversation.list"'],
  ['"session.messages"', '"conversation.messages"'],
  ['"session.patchTitle"', '"conversation.patchTitle"'],
  ['"session.subscribe"', '"conversation.subscribe"'],
  ['"session.acpDock"', '"conversation.acpDock"'],
  ['"session.commands"', '"conversation.commands"'],
  ['"session.updated"', '"conversation.updated"'],
  ["session.subscribe", "conversation.subscribe"],
  ["session.create", "conversation.create"],
  ["session.list", "conversation.list"],
  ["session.messages", "conversation.messages"],
  ["session.patchTitle", "conversation.patchTitle"],
  ["session.acpDock", "conversation.acpDock"],
  ["session.commands", "conversation.commands"],
  ["session.updated", "conversation.updated"],

  // Tools
  ["session_search", "conversation_search"],
  ["session_scroll", "conversation_scroll"],
  ['registerToolSet(\n    "session"', 'registerToolSet(\n    "conversation"'],
  ['registerToolSet("session"', 'registerToolSet("conversation"'],
  ['getToolSet("session")', 'getToolSet("conversation")'],
  ['getTool("session_search")', 'getTool("conversation_search")'],
  ['getTool("session_scroll")', 'getTool("conversation_scroll")'],

  // Commands
  ["new_session_id", "new_conversation_id"],
  ['CommandScope = "session"', 'CommandScope = "conversation"'],
  ['(c.scope ?? "session")', '(c.scope ?? "conversation")'],
  ['scope: "session"', 'scope: "conversation"'],

  // Paths & routes
  ["/chamber/sessions", "/chamber/conversations"],
  ["chamber/sessions", "chamber/conversations"],
  ["$sessionId", "$conversationId"],
  ["sessionId:", "conversationId:"],
  ["sessionId)", "conversationId)"],
  ["sessionId,", "conversationId,"],
  ["sessionId ", "conversationId "],
  ["sessionId=", "conversationId="],
  ["sessionId}", "conversationId}"],
  ["sessionId?", "conversationId?"],
  ["sessionId;", "conversationId;"],
  ["sessionId]", "conversationId]"],
  ["sessionId'", "conversationId'"],
  ['sessionId"', 'conversationId"'],
  ["sessionId`", "conversationId`"],
  ["session: string", "conversation: string"],
  ["(session:", "(conversation:"],
  ["session,", "conversation,"],
  [" session)", " conversation)"],
  [" session,", " conversation,"],
  [" session ", " conversation "],
  ["sessionId.slice", "conversationId.slice"],
  ["ctx.sessionId", "ctx.conversationId"],

  // WebUI handlers/routes
  ["handlers/sessions.ts", "handlers/conversations.ts"],
  ["routes/sessions.ts", "routes/conversations.ts"],
  ["elysia/routes/sessions", "elysia/routes/conversations"],
  ["connectors/db-pg/session/", "connectors/db-pg/conversation/"],
  ["runtime/session/", "runtime/conversation/"],
  ["@freeanima/runtime/session", "@freeanima/runtime/conversation"],
  ["repos/ports/session.ts", "repos/ports/conversation.ts"],
  ["domain/session-meta.ts", "domain/conversation-meta.ts"],
  ["tools/src/session.ts", "tools/src/conversation.ts"],
  ["ports/session-close", "ports/conversation-close"],
  ["ports/session.ts", "ports/conversation.ts"],

  // i18n keys (partial - values updated separately)
  ["webui_chamber_nav_sessions", "webui_chamber_nav_conversations"],
  ["webui_nav_sessions", "webui_nav_conversations"],
  ["webui_common_sessions", "webui_common_conversations"],
  ["webui_chamber_sessions_", "webui_chamber_conversations_"],
  ["webui_chat_sessions_", "webui_chat_conversations_"],
  ["webui_chamber_dashboard_sessions", "webui_chamber_dashboard_conversations"],
  ["webui_chamber_memory_type_session", "webui_chamber_memory_type_conversation"],
  ["webui_chamber_fridge_badge_session", "webui_chamber_fridge_badge_conversation"],
  ["webui_chamber_commands_session_", "webui_chamber_commands_conversation_"],
  ["webui_chamber_system_prompt_mode_session", "webui_chamber_system_prompt_mode_conversation"],
  ["webui_chamber_system_prompt_session_", "webui_chamber_system_prompt_conversation_"],
  ["webui_common_new_session", "webui_common_new_conversation"],
  ["webui_common_session_label", "webui_common_conversation_label"],
  ["webui_chat_select_session", "webui_chat_select_conversation"],
  ["webui_studio_toggle_session_", "webui_studio_toggle_conversation_"],
  ["webui_studio_toggle_session_panel", "webui_studio_toggle_conversation_panel"],

  // Misc
  ["Current session", "Current conversation"],
  ["current session", "current conversation"],
  ["this session", "this conversation"],
  ["per-session", "per-conversation"],
  ["in-session", "in-conversation"],
  ["cross-session", "cross-conversation"],
  ["跨 session", "跨对话"],
  ["跨会话", "跨对话"],
  ["Bound session/turn", "Bound conversation/turn"],
  ["Conversation Session + Message", "Conversation + Message"],
  ["excludes session_meta", "excludes conversation_meta"],
  ["on session delete", "on conversation delete"],
  ["cascade invalidate on session", "cascade invalidate on conversation"],
  ["Monotonic in-session", "Monotonic in-conversation"],
  ["Look up in-session", "Look up in-conversation"],
  ["default session", "default conversation"],
  ["Default session", "Default conversation"],
  ["session-level", "conversation-level"],
  ["Session-level", "Conversation-level"],
  ["session scope", "conversation scope"],
  ["Session scope", "Conversation scope"],
  ["optional session", "optional conversation"],
  ["specified session", "specified conversation"],
  ["within specified session", "within specified conversation"],
  ["only within specified session", "only within specified conversation"],
  ["New session", "New conversation"],
  ["new session", "new conversation"],
  ["auto-create sessions", "auto-create conversations"],
  ["活跃 session", "活跃对话"],
  ["来源 session", "来源对话"],
  ["session 过滤", "对话过滤"],
  ["session 对比", "对话对比"],
  ["session_meta.tools", "conversation_meta.tools"],
  ["session override", "conversation override"],
  ["Session 对比", "对话对比"],
  ["Session（可选）", "对话（可选）"],
  ["sessions 与工具", "conversations 与工具"],
  ["sessions 表", "conversations 表"],
  ["sessions 表名", "conversations 表名"],
  ["sessions.platform_info", "conversations.platform_info"],
  ["sessions.updated_at", "conversations.updated_at"],
  ["sessions.compression", "conversations.compression"],
  ["sessions.todos", "conversations.todos"],
  ["sessions.awaiting_clarify", "conversations.awaiting_clarify"],
  ["sessions.acp_tasks", "conversations.acp_tasks"],
  ["sessions.cached_toolsets", "conversations.cached_toolsets"],
  ["sessions.staged_toolsets", "conversations.staged_toolsets"],
  ["sessions.functions", "conversations.functions"],
  ["sessions.goal", "conversations.goal"],
  ["PG Session", "PG Conversation"],
  ["PG sessions", "PG conversations"],
  ["Cron 建 Session", "Cron 建 Conversation"],
  ["initSession(platform:cron)", "initConversation(platform:cron)"],
  ["service-sessions", "service-conversations"],
  ["Slice A", "Slice A"],
];

const FILE_RENAMES: Array<[string, string]> = [
  ["core/src/db/schema/sessions.ts", "core/src/db/schema/conversations.ts"],
  ["core/src/db/schema/jsonb/session-jsonb.ts", "core/src/db/schema/jsonb/conversation-jsonb.ts"],
  [
    "core/src/db/schema/jsonb/session-meta-jsonb.ts",
    "core/src/db/schema/jsonb/conversation-meta-jsonb.ts",
  ],
  ["core/src/db/domain/session-meta.ts", "core/src/db/domain/conversation-meta.ts"],
  ["core/src/repos/ports/session.ts", "core/src/repos/ports/conversation.ts"],
  ["core/src/repos/adapters/null-session.ts", "core/src/repos/adapters/null-conversation.ts"],
  ["core/src/tool/default-session-toolsets.ts", "core/src/tool/default-conversation-toolsets.ts"],
  [
    "core/src/tool/default-session-toolsets.test.ts",
    "core/src/tool/default-conversation-toolsets.test.ts",
  ],
  ["core/src/tool/session-tools.ts", "core/src/tool/conversation-tools.ts"],
  ["core/src/tool/session-todos.ts", "core/src/tool/conversation-todos.ts"],
  ["core/src/tool/session-conversation-port.ts", "core/src/tool/conversation-port.ts"],
  ["core/src/llm/session-title.ts", "core/src/llm/conversation-title.ts"],
  ["core/src/llm/session-title.test.ts", "core/src/llm/conversation-title.test.ts"],
  [
    "core/src/compress/test-helpers/session-fixtures.ts",
    "core/src/compress/test-helpers/conversation-fixtures.ts",
  ],
  ["core/scripts/session-size.sql", "core/scripts/conversation-size.sql"],
  ["capabilities/tools/src/session.ts", "capabilities/tools/src/conversation.ts"],
  ["capabilities/tools/src/session.test.ts", "capabilities/tools/src/conversation.test.ts"],
  ["capabilities/memory/src/session-port.ts", "capabilities/memory/src/conversation-port.ts"],
  [
    "capabilities/memory/src/tool-conversation-port.ts",
    "capabilities/memory/src/tool-conversation-port.ts",
  ],
  ["runtime/src/session/session-crud.ts", "runtime/src/conversation/conversation-crud.ts"],
  [
    "runtime/src/session/session-store-pg-bridge.ts",
    "runtime/src/conversation/conversation-store-pg-bridge.ts",
  ],
  ["runtime/src/session/mask-port.ts", "runtime/src/conversation/mask-port.ts"],
  ["runtime/src/session/message.ts", "runtime/src/conversation/stored-message.ts"],
  ["runtime/src/session/index.ts", "runtime/src/conversation/session-index-legacy.ts"],
  [
    "runtime/src/conversation/session-handoff.ts",
    "runtime/src/conversation/conversation-handoff.ts",
  ],
  [
    "runtime/src/conversation/session-handoff.test.ts",
    "runtime/src/conversation/conversation-handoff.test.ts",
  ],
  ["runtime/src/conversation/session-todos.ts", "runtime/src/conversation/conversation-todos.ts"],
  [
    "runtime/src/conversation/session-tools.test.ts",
    "runtime/src/conversation/conversation-tools.test.ts",
  ],
  ["platform/ports/session-close.ts", "platform/ports/conversation-close.ts"],
  ["platform/src/acp-session-callback.ts", "platform/src/acp-conversation-callback.ts"],
  ["platform/src/acp-session-callback.test.ts", "platform/src/acp-conversation-callback.test.ts"],
  ["platform/src/runtime/service-sessions.ts", "platform/src/runtime/service-conversations.ts"],
  ["platform/src/runtime/session-manager.ts", "platform/src/runtime/conversation-manager.ts"],
  ["platform/src/runtime/session-title.ts", "platform/src/runtime/conversation-title.ts"],
  ["platform/src/runtime/session-title.test.ts", "platform/src/runtime/conversation-title.test.ts"],
  [
    "platform/src/runtime/use-cases/on-session-close.ts",
    "platform/src/runtime/use-cases/on-conversation-close.ts",
  ],
  [
    "platform/connectors/db-pg/session/pg-session-store.ts",
    "platform/connectors/db-pg/conversation/pg-conversation-store.ts",
  ],
  [
    "platform/connectors/db-pg/session/repos/session-repo.ts",
    "platform/connectors/db-pg/conversation/repos/conversation-repo.ts",
  ],
  [
    "platform/connectors/db-pg/session/repos/message-repo.ts",
    "platform/connectors/db-pg/conversation/repos/message-repo.ts",
  ],
  [
    "platform/connectors/db-pg/session/repos/message-fts-repo.ts",
    "platform/connectors/db-pg/conversation/repos/message-fts-repo.ts",
  ],
  [
    "platform/connectors/db-pg/session/repos/purge-cron-sessions.ts",
    "platform/connectors/db-pg/conversation/repos/purge-cron-conversations.ts",
  ],
  [
    "platform/connectors/db-pg/session/mappers/session-mapper.ts",
    "platform/connectors/db-pg/conversation/mappers/conversation-mapper.ts",
  ],
  [
    "platform/connectors/db-pg/session/mappers/message-mapper.ts",
    "platform/connectors/db-pg/conversation/mappers/message-mapper.ts",
  ],
  [
    "platform/connectors/db-pg/limbic-memory/repos/limbic-by-sessions-repo.ts",
    "platform/connectors/db-pg/limbic-memory/repos/limbic-by-conversations-repo.ts",
  ],
  [
    "platform/connectors/webui/handlers/sessions.ts",
    "platform/connectors/webui/handlers/conversations.ts",
  ],
  [
    "platform/connectors/webui/handlers/session-events.ts",
    "platform/connectors/webui/handlers/conversation-events.ts",
  ],
  [
    "platform/connectors/webui/elysia/routes/sessions.ts",
    "platform/connectors/webui/elysia/routes/conversations.ts",
  ],
  [
    "platform/connectors/webui/app/src/stores/chamber-sessions.ts",
    "platform/connectors/webui/app/src/stores/chamber-conversations.ts",
  ],
  [
    "platform/connectors/webui/app/src/components/chamber/SessionMessagePanel.tsx",
    "platform/connectors/webui/app/src/components/chamber/ConversationMessagePanel.tsx",
  ],
  [
    "packages/sap-contract/src/frames/session.ts",
    "packages/sap-contract/src/frames/conversation.ts",
  ],
  [
    "packages/sap-contract/src/session-stream-core.ts",
    "packages/sap-contract/src/conversation-stream-core.ts",
  ],
  ["satellites/chat/app/src/stores/sessions.ts", "satellites/chat/app/src/stores/conversations.ts"],
  [
    "satellites/pair-programming/app/src/components/SessionPanel.tsx",
    "satellites/pair-programming/app/src/components/ConversationPanel.tsx",
  ],
  ["tests/integration/db/db-session.test.ts", "tests/integration/db/db-conversation.test.ts"],
  [
    "tests/integration/db/session-cleanup.test.ts",
    "tests/integration/db/conversation-cleanup.test.ts",
  ],
  [
    "tests/integration/clarify/clarify-session.test.ts",
    "tests/integration/clarify/clarify-conversation.test.ts",
  ],
];

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      files.push(...(await walk(p)));
    } else {
      files.push(p);
    }
  }
  return files;
}

function applyReplacements(content: string): string {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

async function main(): Promise<void> {
  // File renames (target may already exist from cp)
  for (const [from, to] of FILE_RENAMES) {
    const fromPath = join(ROOT, from);
    const toPath = join(ROOT, to);
    try {
      await stat(fromPath);
      try {
        await stat(toPath);
        await unlink(fromPath);
      } catch {
        await rename(fromPath, toPath);
      }
    } catch {
      // source missing — already renamed
    }
  }

  // Remove empty session dirs if possible
  try {
    await unlink(join(ROOT, "runtime/src/session/index.ts"));
  } catch {
    /* */
  }

  const exts = new Set([
    ".ts",
    ".tsx",
    ".md",
    ".json",
    ".po",
    ".pot",
    ".yaml",
    ".yml",
    ".sql",
    ".xml",
  ]);

  const files = await walk(ROOT);
  let changed = 0;
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (SKIP_FILES.has(rel)) continue;
    if (rel.startsWith("core/migrations/")) continue;
    const ext = file.slice(file.lastIndexOf("."));
    if (!exts.has(ext)) continue;
    const raw = await readFile(file, "utf8");
    const next = applyReplacements(raw);
    if (next !== raw) {
      await writeFile(file, next);
      changed++;
    }
  }
  console.log(`Updated ${changed} files`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

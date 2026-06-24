/**
 * 第二轮 Session→Conversation 术语清理（保留 ACP/MCP/终端 session 等合法用法）
 * bun scripts/cleanup-session-terminology.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  "dist",
  ".tsout",
  "www",
  "release",
  "vendor",
  "messages/paraglide",
  "core/migrations",
]);

const SKIP_FILES = new Set([
  "scripts/cleanup-session-terminology.ts",
  "scripts/rename-session-to-conversation.ts",
  "scripts/fix-conversation-rename-breakage.ts",
]);

const REPLACEMENTS: [string, string][] = [
  ["useChamberSessionsStore", "useChamberConversationsStore"],
  ["ChamberSessionsState", "ChamberConversationsState"],
  ["ChamberSessionsPage", "ChamberConversationsPage"],
  ["SessionDetailPage", "ConversationDetailPage"],
  ["SessionStatCard", "ConversationStatCard"],
  ["SESSIONS_PAGE_SIZE", "CONVERSATIONS_PAGE_SIZE"],
  ["SESSIONS_CACHE_TTL_MS", "CONVERSATIONS_CACHE_TTL_MS"],
  ["sessionsTotal", "conversationsTotal"],
  ["sessionsPage", "conversationsPage"],
  ["sessionsFetchedAt", "conversationsFetchedAt"],
  ["loadingSessions", "loadingConversations"],
  ["sessionsPageCount", "conversationsPageCount"],
  ["currentSessionsPage", "currentConversationsPage"],
  ["goToSessionsPage", "goToConversationsPage"],
  ["findSession(", "findConversation("],
  ["fetchSessions(", "fetchConversations("],
  ["ensureSessionHeadline(", "ensureConversationHeadline("],
  ["selectSession(", "selectConversation("],
  ["resolveSessionPlatform", "resolveConversationPlatform"],
  ["fetchSessionAcpDock", "fetchConversationAcpDock"],
  ["iterateSessionEvents", "iterateConversationEvents"],
  ["sessionListQuerySchema", "conversationListQuerySchema"],
  ["getSessionAcpDock", "getConversationAcpDock"],
  ["SessionAcpDockSnapshot", "ConversationAcpDockSnapshot"],
  ["SessionAcpDockTask", "ConversationAcpDockTask"],
  ["listSessionCommands", "listConversationCommands"],
  ["listAllSessions", "listAllConversations"],
  ["watchSession(", "watchConversation("],
  ["getSessionAcpDock(", "getConversationAcpDock("],
  ["buildSessionsByPlatform", "buildConversationsByPlatform"],
  ["maybeGenerateSessionTitleAsync", "maybeGenerateConversationTitleAsync"],
  ["generateSessionHandoffSummary", "generateConversationHandoffSummary"],
  ["CleanupStaleSessionsResult", "CleanupStaleConversationsResult"],
  ["sessionLastActivityMs", "conversationLastActivityMs"],
  ["resolveFoundOriginSession", "resolveFoundOriginConversation"],
  ["pgWriteDeleteSession", "pgWriteDeleteConversation"],
  ["pgCountSessionsByPlatform", "pgCountConversationsByPlatform"],
  ["pgListSessionSummariesPage", "pgListConversationSummariesPage"],
  ["pgListSessionSummaries", "pgListConversationSummaries"],
  ["pgDeleteDebugSessions", "pgDeleteDebugConversations"],
  ["pgListDebugSessionIds", "pgListDebugConversationIds"],
  ["pgListSessionIdsMatchingPlatformProbe", "pgListConversationIdsMatchingPlatformProbe"],
  ["pgFindSessionIdByPlatformInfo", "pgFindConversationIdByPlatformInfo"],
  ["pgGetSessionMetaLite", "pgGetConversationMetaLite"],
  ["pgGetSessionMeta", "pgGetConversationMeta"],
  ["sanitizeSessionTitle", "sanitizeConversationTitle"],
  ["fallbackSessionTitle", "fallbackConversationTitle"],
  ["GenerateSessionTitleResult", "GenerateConversationTitleResult"],
  ["generateSessionTitle", "generateConversationTitle"],
  ["sessionMessagesToInvokeInput", "storedMessagesToInvokeInput"],
  ["SessionToolMaskFilter", "ConversationToolMaskFilter"],
  ["registerSessionToolMaskFilter", "registerConversationToolMaskFilter"],
  ["sessionHasCapabilityMask", "conversationHasCapabilityMask"],
  ["loadToolSetsIntoSession", "loadToolSetsIntoConversation"],
  ["resetSessionToolSetsToDefault", "resetConversationToolsetsToDefault"],
  ["LoadToolSetsIntoSessionResult", "LoadToolSetsIntoConversationResult"],
  ["handleSessionTodo", "handleConversationTodo"],
  ["DefaultSessionToolSetName", "DefaultConversationToolSetName"],
  ["listDebugSessionIds", "listDebugConversationIds"],
  ["listBySourceSessions(", "listBySourceConversations("],
  ["listBySession(", "listByConversation("],
  ["source_session:", "source_conversation:"],
  ["source_session?", "source_conversation?"],
  ["source_session ", "source_conversation "],
  ["resolveSessionHandoffOnNew", "resolveConversationHandoffOnNew"],
  ["resolveSessionCapabilityMask", "resolveConversationCapabilityMask"],
  ["resolveSessionMaskFromMeta", "resolveConversationMaskFromMeta"],
  ["SessionCapabilityMask", "ConversationCapabilityMask"],
  ["ensureConversationToolIntegrity", "ensureConversationToolIntegrity"],
  ["useSessionsStore", "useConversationsStore"],
  ["SessionsState", "ConversationsState"],
  ["createNewSession", "createNewConversation"],
  ["currentSessionId", "currentConversationId"],
  ["setRecentSessions", "setRecentConversations"],
  ["recentSessions", "recentConversations"],
  ["totalSessions", "totalConversations"],
  ["sessionByPlatform", "conversationsByPlatform"],
  ["sessionPlatformRows", "conversationPlatformRows"],
  ["mapSessionList", "mapConversationList"],
  ["onSessionUpdated", "onConversationUpdated"],
  ["onSessionCloseBeforeNew", "onConversationCloseBeforeNew"],
  ["registerOnSessionCloseBeforeNew", "registerOnConversationCloseBeforeNew"],
  ["unregisterOnSessionCloseBeforeNew", "unregisterOnConversationCloseBeforeNew"],
  ["OnSessionCloseBeforeNewFn", "OnConversationCloseBeforeNewFn"],
  ["session_updated", "conversation_updated"],
  ["LightSleepSessionBlock", "LightSleepConversationBlock"],
  ["truncatedSessions", "truncatedConversations"],
  ["SessionCompressionFields", "ConversationCompressionFields"],
  ["resolveSessionCompressionFields", "resolveConversationCompressionFields"],
  ["lastToolAtBySession", "lastToolAtByConversation"],
  ["registerToolSessionResolver", "registerToolConversationResolver"],
  [
    'REPAIR_REASON_LOST = "tool response lost (session repair)"',
    'REPAIR_REASON_LOST = "tool response lost (conversation repair)"',
  ],
  ['SUMMARY_USER_PREFIX = "[session summary]"', 'SUMMARY_USER_PREFIX = "[conversation summary]"'],
  ['mode: z.enum(["global", "session"])', 'mode: z.enum(["global", "conversation"])'],
  ['mode: z.enum(["registry", "session"])', 'mode: z.enum(["registry", "conversation"])'],
  ['module: "session"', 'module: "conversation"'],
  ["sessions: { total:", "conversations: { total:"],
  ["svc?.sessions?", "svc?.conversations?"],
  ["svc.sessions?", "svc.conversations?"],
  ["(resp as { sessions?:", "(resp as { conversations?:"],
  [".sessions ??", ".conversations ??"],
  ["sessions: ConversationListItem[]", "conversations: ConversationListItem[]"],
  ["sessions: []", "conversations: []"],
  ["sessions,", "conversations,"],
  ["get().sessions", "get().conversations"],
  ["state.sessions", "state.conversations"],
  ["store.sessions", "store.conversations"],
  ["resp.sessions", "resp.conversations"],
  ["const sessions =", "const conversations ="],
  ["sessions.length", "conversations.length"],
  ["sessions[0]", "conversations[0]"],
  ["sessions.map", "conversations.map"],
  ["sessions ??", "conversations ??"],
  ["`session ${conversationId}", "`conversation ${conversationId}"],
  ["session does not exist", "conversation does not exist"],
  ["Session platform mismatch", "Conversation platform mismatch"],
  ["Session not found", "Conversation not found"],
  ["create session", "create conversation"],
  ["session tools jsonb", "conversation tools jsonb"],
  ["Session message FTS", "Conversation message FTS"],
  ["Session id for memory", "Conversation id for memory"],
  ["Cross-session todo", "Cross-conversation todo"],
  ["cron platform session", "cron platform conversation"],
  ["Null Session port", "Null Conversation port"],
  ["AI agent session", "AI agent conversation"],
  ["init_session", "init_conversation"],
  ["read-only old session", "read-only old conversation"],
  ["/api/sessions/messages/stream", "/api/conversations/messages/stream"],
  ["sessionMetaToInsert", "conversationMetaToInsert"],
  ["rowToSessionMeta", "rowToConversationMeta"],
  ["sessionUpdated", "conversationUpdated"],
  ["SessionUpdatedPayload", "ConversationUpdatedPayload"],
  ["sessionUpdatedPayloadSchema", "conversationUpdatedPayloadSchema"],
  ['"session:updated"', '"conversation:updated"'],
  ["sessionManager", "conversationManager"],
  ["sessionWatchers", "conversationWatchers"],
  ["sessionAbortControllers", "conversationAbortControllers"],
  ["SessionRecallHit", "ConversationRecallHit"],
  [
    'MemoryRecallHitType = "semantic" | "session"',
    'MemoryRecallHitType = "semantic" | "conversation"',
  ],
  ['memory_type: "session"', 'memory_type: "conversation"'],
  ['memory_type === "session"', 'memory_type === "conversation"'],
  ["memory_type === 'session'", "memory_type === 'conversation'"],
  ['"session", "limbic"', '"conversation", "limbic"'],
  ['type === "session"', 'type === "conversation"'],
  ['FRIDGE_MODULES = new Set(["session"', 'FRIDGE_MODULES = new Set(["conversation"'],
  ['magnetRedisKey("session"', 'magnetRedisKey("conversation"'],
  ['setMagnet("session"', 'setMagnet("conversation"'],
  ['getMagnet("session"', 'getMagnet("conversation"'],
  ['deleteMagnet("session"', 'deleteMagnet("conversation"'],
  ['module === "session"', 'module === "conversation"'],
  ['z.enum(["session", "tasks"', 'z.enum(["conversation", "tasks"'],
  ['z.literal("session")', 'z.literal("conversation")'],
  ['enum: ["session", "dream"', 'enum: ["conversation", "dream"'],
  ['searchParams.get("session")', 'searchParams.get("conversation")'],
  ['searchParams.set("session"', 'searchParams.set("conversation"'],
  ['searchParams.delete("session")', 'searchParams.delete("conversation"'],
  ["debug sessions", "debug conversations"],
  ["Cleaning up debug sessions", "Cleaning up debug conversations"],
  ["conversation sessions use PostgreSQL", "conversations use PostgreSQL"],
  ['scope: c.scope ?? "session"', 'scope: c.scope ?? "conversation"'],
  ["buildSemanticSourceSessionsCondition", "buildSemanticSourceConversationsCondition"],
  ["requires non-empty sessions", "requires non-empty conversations"],
  ["aborts engine run for all active sessions", "aborts engine run for all active conversations"],
  ["creates dream without sessions when", "creates dream without conversations when"],
  ["/** Session ID `", "/** Conversation ID `"],
  ["Session platform mismatch", "Conversation platform mismatch"],
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      const rel = relative(ROOT, p);
      if (SKIP_DIR.has(name) || SKIP_DIR.has(rel) || rel.startsWith("satellites/app-mobile/www"))
        continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx|json)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function apply(s: string): string {
  let next = s;
  for (const [from, to] of REPLACEMENTS) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (SKIP_FILES.has(rel)) continue;
  if (rel.includes("browser-camofox")) continue;
  if (rel.includes("capabilities/acp/") && !rel.endsWith(".test.ts")) {
    // ACP 协议层保留 session 术语
    continue;
  }
  const raw = readFileSync(file, "utf8");
  const next = apply(raw);
  if (next !== raw) {
    writeFileSync(file, next);
    changed++;
  }
}

console.log(`Updated ${changed} files`);
